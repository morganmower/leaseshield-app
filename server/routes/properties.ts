import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, requireAccess } from "../jwtAuth";
import { insertPropertySchema } from "@shared/schema";
import { getUserId } from "./_shared";

export async function registerPropertiesRoutes(app: Express) {
  // Property routes
  app.get('/api/properties', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const properties = await storage.getPropertiesByUserId(userId);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get('/api/properties/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const property = await storage.getProperty(req.params.id, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  app.post('/api/properties', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Validate input to prevent malicious data
      const validatedData = insertPropertySchema.parse({
        ...req.body,
        userId,
      });
      
      const property = await storage.createProperty(validatedData);

      await storage.trackEvent({
        userId,
        eventType: 'property_created',
        eventData: { propertyId: property.id, propertyName: property.name },
      });

      res.json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error creating property:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.put('/api/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate input to prevent malicious data
      const validatedData = insertPropertySchema.partial().parse(req.body);
      
      const updatedProperty = await storage.updateProperty(req.params.id, userId, validatedData);
      if (!updatedProperty) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(updatedProperty);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error updating property:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.delete('/api/properties/:id', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const deleted = await storage.deleteProperty(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting property:", error);
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Retention Settings routes
  app.get('/api/properties/:id/retention', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const property = await storage.getProperty(req.params.id, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      let settings = await storage.getRetentionSettings(req.params.id);
      if (!settings) {
        settings = {
          id: '',
          propertyId: req.params.id,
          deniedUploadsDays: 730,
          deniedBankStatementsDays: 120,
          approvedUploadsDays: 2555,
          approvedBankStatementsDays: 730,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching retention settings:", error);
      res.status(500).json({ message: "Failed to fetch retention settings" });
    }
  });

  app.put('/api/properties/:id/retention', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const property = await storage.getProperty(req.params.id, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const { deniedUploadsDays, deniedBankStatementsDays, approvedUploadsDays, approvedBankStatementsDays } = req.body;

      const values = [deniedUploadsDays, deniedBankStatementsDays, approvedUploadsDays, approvedBankStatementsDays].map(Number);
      if (values.some((n) => !Number.isFinite(n) || n < 0 || n > 36500)) {
        return res.status(400).json({ message: "Invalid retention values (must be 0-36500 days)" });
      }

      const settings = await storage.upsertRetentionSettings({
        propertyId: req.params.id,
        deniedUploadsDays: values[0],
        deniedBankStatementsDays: values[1],
        approvedUploadsDays: values[2],
        approvedBankStatementsDays: values[3],
      });

      res.json(settings);
    } catch (error) {
      console.error("Error updating retention settings:", error);
      res.status(500).json({ message: "Failed to update retention settings" });
    }
  });
}
