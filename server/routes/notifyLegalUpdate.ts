import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { users } from "@shared/schema";
import { getUncachableResendClient } from "../resend";
import { generateLegalUpdateEmail } from "../email-templates";

export async function registerNotifyLegalUpdateRoute(app: Express) {

  // Send legal update notifications (admin only)
  app.post('/api/admin/notify-legal-update/:updateId', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { updateId } = req.params;
      
      // Get the legal update with state info
      const update = await storage.getLegalUpdateById(updateId);
      if (!update) {
        return res.status(404).json({ message: "Legal update not found" });
      }
      
      const state = await storage.getStateById(update.stateId);
      if (!state) {
        return res.status(404).json({ message: "State not found" });
      }
      
      // Get all users who have this state as their preferred state or all users for high impact
      // Filter to only users who have opted in to legal update notifications
      const allUsers = update.impactLevel === 'high' 
        ? await storage.getAllActiveUsers() 
        : await storage.getUsersByState(update.stateId);
      
      // Only notify users who have opted in to legal update notifications
      const users = allUsers.filter(u => u.notifyLegalUpdates !== false);
      
      const { client, fromEmail } = await getUncachableResendClient();
      
      let successCount = 0;
      let errorCount = 0;
      
      // Send emails to opted-in users only
      for (const user of users) {
        if (!user.email) continue;
        
        try {
          const emailData = generateLegalUpdateEmail({
            update: {
              ...update,
              whatChanged: (update as any).beforeText && (update as any).afterText 
                ? `Before: ${(update as any).beforeText}\n\nAfter: ${(update as any).afterText}` 
                : null,
              nextSteps: null,
            },
            state: { ...state, code: state.id },
            userEmail: user.email,
            userName: user.firstName || undefined,
          });
          
          await client.emails.send({
            from: fromEmail,
            to: user.email,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
          });
          
          // Create in-app notification
          await storage.createUserNotification({
            userId: user.id,
            legalUpdateId: updateId,
            isRead: false,
          });
          
          successCount++;
        } catch (emailError) {
          console.error(`Failed to send email to ${user.email}:`, emailError);
          errorCount++;
        }
      }
      
      res.json({ 
        success: true,
        sent: successCount,
        failed: errorCount,
        total: users.length
      });
    } catch (error) {
      console.error("Error sending notifications:", error);
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });
}
