import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { getActiveStateIds } from "../states/getActiveStates";
import { getUserId } from "./_shared";

export async function registerUserSettingsRoutes(app: Express) {
  // User preferences - with strict input validation
  const userPreferencesSchema = z.object({
    preferredState: z.string().length(2).regex(/^[A-Z]{2}$/).optional(),
    // Notification preferences
    notifyLegalUpdates: z.boolean().optional(),
    notifyTemplateRevisions: z.boolean().optional(),
    notifyBillingAlerts: z.boolean().optional(),
    notifyTips: z.boolean().optional(),
    // Profile info
    businessName: z.string().max(100).optional().nullable(),
    phoneNumber: z.string().max(20).optional().nullable(),
  });
  
  app.patch('/api/user/settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Validate input to prevent malicious data
      const validatedData = userPreferencesSchema.parse(req.body);
      
      // Only allow supported states - dynamically fetched from database
      if (validatedData.preferredState) {
        try {
          const supportedStates = await getActiveStateIds();
          if (!supportedStates.includes(validatedData.preferredState)) {
            return res.status(400).json({ message: "Invalid state selection" });
          }
        } catch (error) {
          console.error("Error fetching active states:", error);
          return res.status(500).json({ message: "Unable to validate state selection" });
        }
      }
      
      const user = await storage.updateUserPreferences(userId, validatedData);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error updating user preferences:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });
}
