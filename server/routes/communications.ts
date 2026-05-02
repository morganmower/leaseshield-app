import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { getUserId } from "./_shared";

export async function registerCommunicationsRoutes(app: Express) {
  // Communication templates routes
  app.get('/api/communications', isAuthenticated, async (req: any, res) => {
    try {
      const { stateId } = req.query;
      console.log(`[communications] 🔍 Fetching templates - stateId=${stateId}, query=${JSON.stringify(req.query)}`);
      if (!stateId) {
        const templates = await storage.getAllCommunicationTemplates();
        console.log(`[communications] ✅ Returning all ${templates.length} templates`);
        return res.json(templates);
      }
      console.log(`[communications] 📊 Database query starting for state: ${stateId}`);
      const templates = await storage.getCommunicationTemplatesByState(stateId as string);
      console.log(`[communications] ✅ Query successful - found ${templates.length} templates for state ${stateId}`);
      if (templates.length === 0) {
        console.warn(`[communications] ⚠️ WARNING: No templates found for state ${stateId}. Check database connectivity and data.`);
      }
      res.json(templates);
    } catch (error: any) {
      console.error(`[communications] ❌ ERROR fetching templates:`, error?.message || error);
      console.error(`[communications] Full error:`, error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post('/api/communications', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(getUserId(req));
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin only" });
      }
      
      const data = req.body;
      const template = await storage.createCommunicationTemplate(data);
      res.json(template);
    } catch (error) {
      console.error("Error creating communication template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });
}
