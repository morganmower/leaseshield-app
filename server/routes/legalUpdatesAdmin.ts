import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAccess, requireAdmin } from "../jwtAuth";
import { insertLegalUpdateSchema, users } from "@shared/schema";

export async function registerLegalUpdatesAdminRoutes(app: Express) {

  app.get('/api/legal-updates/recent', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const updates = await storage.getRecentLegalUpdates(5);
      res.json(updates);
    } catch (error) {
      console.error("Error fetching recent legal updates:", error);
      res.status(500).json({ message: "Failed to fetch recent legal updates" });
    }
  });

  // Admin: Get all legal updates
  app.get('/api/admin/legal-updates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const updates = await storage.getAllLegalUpdates();
      res.json(updates);
    } catch (error) {
      console.error("Error fetching all legal updates:", error);
      res.status(500).json({ message: "Failed to fetch legal updates" });
    }
  });

  // Admin: Create legal update
  app.post('/api/admin/legal-updates', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const validatedData = insertLegalUpdateSchema.parse(req.body);
      const update = await storage.createLegalUpdate(validatedData);

      // Optionally: Create notifications for affected users
      // This would be done in a background job in production

      res.json(update);
    } catch (error) {
      console.error("Error creating legal update:", error);
      res.status(500).json({ message: "Failed to create legal update" });
    }
  });

  // Admin: Update legal update
  app.put('/api/admin/legal-updates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertLegalUpdateSchema.partial().parse(req.body);
      const update = await storage.updateLegalUpdate(id, validatedData);
      res.json(update);
    } catch (error) {
      console.error("Error updating legal update:", error);
      res.status(500).json({ message: "Failed to update legal update" });
    }
  });

  // Admin: Delete legal update
  app.delete('/api/admin/legal-updates/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLegalUpdate(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting legal update:", error);
      res.status(500).json({ message: "Failed to delete legal update" });
    }
  });
}
