import type { Express } from "express";
import { storage } from "../storage";

export async function registerStatesRoute(app: Express) {
  // States routes - API-driven source of truth for all state dropdowns
  app.get('/api/states', async (req, res) => {
    try {
      const { active } = req.query;
      // Default: return only active states
      // Pass active=false to include inactive states (admin use)
      const includeInactive = active === 'false';
      const states = await storage.getAllStates({ includeInactive });
      res.json(states);
    } catch (error) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });
}
