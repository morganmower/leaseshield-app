import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAccess, requireAdmin } from "../jwtAuth";
import { insertComplianceCardSchema } from "@shared/schema";

export async function registerComplianceCardsRoutes(app: Express) {
  // Compliance routes
  app.get('/api/compliance-cards', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const { stateId } = req.query;
      if (!stateId) {
        return res.status(400).json({ message: "stateId is required" });
      }
      const cards = await storage.getComplianceCardsByState(stateId as string);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching compliance cards:", error);
      res.status(500).json({ message: "Failed to fetch compliance cards" });
    }
  });

  // Admin: Get all compliance cards
  app.get('/api/admin/compliance-cards', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const cards = await storage.getAllComplianceCards();
      res.json(cards);
    } catch (error) {
      console.error("Error fetching all compliance cards:", error);
      res.status(500).json({ message: "Failed to fetch compliance cards" });
    }
  });

  // Admin: Create compliance card
  app.post('/api/admin/compliance-cards', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const validatedData = insertComplianceCardSchema.parse(req.body);
      const card = await storage.createComplianceCard(validatedData);
      res.json(card);
    } catch (error) {
      console.error("Error creating compliance card:", error);
      res.status(500).json({ message: "Failed to create compliance card" });
    }
  });

  // Admin: Update compliance card
  app.put('/api/admin/compliance-cards/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertComplianceCardSchema.partial().parse(req.body);
      const card = await storage.updateComplianceCard(id, validatedData);
      res.json(card);
    } catch (error) {
      console.error("Error updating compliance card:", error);
      res.status(500).json({ message: "Failed to update compliance card" });
    }
  });

  // Admin: Delete compliance card
  app.delete('/api/admin/compliance-cards/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteComplianceCard(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting compliance card:", error);
      res.status(500).json({ message: "Failed to delete compliance card" });
    }
  });
}
