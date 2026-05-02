import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { users } from "@shared/schema";
import { getUncachableResendClient } from "../resend";
import { getUserId } from "./_shared";

export async function registerAdminBroadcastsRoutes(app: Express) {
  // Get all users for admin
  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });
  
  // Get audience counts for admin broadcast form
  app.get('/api/admin/broadcasts/audience-counts', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const trialUsers = await storage.getTrialingUsers();
      const activeUsers = await storage.getAllActiveUsers();
      res.json({
        trial: trialUsers.length,
        active: activeUsers.length,
        all: trialUsers.length + activeUsers.length,
      });
    } catch (error) {
      console.error("Error getting audience counts:", error);
      res.status(500).json({ message: "Failed to get audience counts" });
    }
  });

  // Get all broadcasts with replies for admin
  app.get('/api/admin/broadcasts', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const broadcasts = await storage.getAllBroadcasts();
      const broadcastsWithReplies = await Promise.all(
        broadcasts.map(async (broadcast) => {
          const replies = await storage.getBroadcastRepliesByBroadcastId(broadcast.id);
          const recipients = await storage.getBroadcastRecipientsByBroadcastId(broadcast.id);
          const readCount = recipients.filter(r => r.isRead).length;
          return {
            ...broadcast,
            replies,
            recipientCount: recipients.length,
            readCount,
          };
        })
      );
      res.json(broadcastsWithReplies);
    } catch (error) {
      console.error("Error getting broadcasts:", error);
      res.status(500).json({ message: "Failed to get broadcasts" });
    }
  });

  // Send a broadcast message
  app.post('/api/admin/broadcasts', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const adminUserId = getUserId(req);
      const { subject, content, audience, userId: targetUserId } = req.body;

      if (!subject || !content || !audience) {
        return res.status(400).json({ message: "Subject, content, and audience are required" });
      }

      if (audience === 'individual' && !targetUserId) {
        return res.status(400).json({ message: "User ID is required for individual messages" });
      }

      // Create the broadcast
      const broadcast = await storage.createBroadcast({
        subject,
        content,
        audience: audience === 'individual' ? 'individual' : audience,
        sentByUserId: adminUserId,
      });

      // Get target users based on audience
      let targetUsers: any[] = [];
      if (audience === 'individual') {
        const user = await storage.getUser(targetUserId);
        if (user) targetUsers = [user];
      } else if (audience === 'trial') {
        targetUsers = await storage.getTrialingUsers();
      } else if (audience === 'active') {
        targetUsers = await storage.getAllActiveUsers();
      } else {
        const trialUsers = await storage.getTrialingUsers();
        const activeUsers = await storage.getAllActiveUsers();
        const uniqueUserIds = new Set<string>();
        targetUsers = [...trialUsers, ...activeUsers].filter(u => {
          if (uniqueUserIds.has(u.id)) return false;
          uniqueUserIds.add(u.id);
          return true;
        });
      }

      // Create recipient records and send emails
      const { client, fromEmail } = await getUncachableResendClient();
      const domain = req.get('host') || 'leaseshield.app';
      const baseUrl = req.secure || req.headers['x-forwarded-proto'] === 'https' 
        ? `https://${domain}` 
        : `http://${domain}`;

      let emailSuccessCount = 0;
      for (const user of targetUsers) {
        // Create recipient record
        await storage.createBroadcastRecipient({
          broadcastId: broadcast.id,
          userId: user.id,
          isRead: false,
          emailSent: false,
        });

        // Send email notification
        if (user.email) {
          try {
            await client.emails.send({
              from: fromEmail,
              to: user.email,
              subject: "You have a new message from LeaseShield",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #14b8a6;">New Message from LeaseShield</h2>
                  <p>Hi${user.firstName ? ` ${user.firstName}` : ''},</p>
                  <p>You have an unread message waiting for you in your LeaseShield account.</p>
                  <p style="margin: 24px 0;">
                    <a href="${baseUrl}/messages" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                      View Message
                    </a>
                  </p>
                  <p style="color: #666; font-size: 14px;">
                    Or copy this link: ${baseUrl}/messages
                  </p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                  <p style="color: #999; font-size: 12px;">
                    LeaseShield - Protecting landlords with legal templates and compliance guidance.
                  </p>
                </div>
              `,
              text: `Hi${user.firstName ? ` ${user.firstName}` : ''},\n\nYou have an unread message waiting for you in your LeaseShield account.\n\nView it here: ${baseUrl}/messages\n\nLeaseShield - Protecting landlords with legal templates and compliance guidance.`,
            });
            emailSuccessCount++;
          } catch (emailError) {
            console.error(`Failed to send broadcast email to ${user.email}:`, emailError);
          }
        }
      }

      // Update recipient count
      await storage.updateBroadcastRecipientCount(broadcast.id, targetUsers.length);

      res.json({
        ...broadcast,
        recipientCount: targetUsers.length,
        emailsSent: emailSuccessCount,
      });
    } catch (error) {
      console.error("Error sending broadcast:", error);
      res.status(500).json({ message: "Failed to send broadcast" });
    }
  });

  // Mark a broadcast reply as read (admin)
  app.post('/api/admin/broadcasts/replies/:replyId/read', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { replyId } = req.params;
      await storage.markBroadcastReplyAsRead(replyId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking reply as read:", error);
      res.status(500).json({ message: "Failed to mark reply as read" });
    }
  });

  // Resend broadcast emails to active subscribers
  app.post('/api/admin/broadcasts/:broadcastId/resend', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { broadcastId } = req.params;
      
      // Get the broadcast
      const broadcast = await storage.getBroadcastById(broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: "Broadcast not found" });
      }

      // Get active subscribers only
      const activeUsers = await storage.getAllActiveUsers();
      
      if (activeUsers.length === 0) {
        return res.json({ success: true, emailsSent: 0, message: "No active subscribers to send to" });
      }

      // Send emails
      const { client, fromEmail } = await getUncachableResendClient();
      const domain = req.get('host') || 'leaseshield.app';
      const baseUrl = req.secure || req.headers['x-forwarded-proto'] === 'https' 
        ? `https://${domain}` 
        : `http://${domain}`;

      let emailSuccessCount = 0;
      // Helper to escape HTML special characters
      const escapeHtml = (text: string) => text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      // Create a brief preview (first 200 characters) for the teaser email
      const rawPreview = broadcast.content.length > 200 
        ? broadcast.content.substring(0, 200).trim() + '...' 
        : broadcast.content;
      const contentPreview = escapeHtml(rawPreview);
      const subjectEscaped = escapeHtml(broadcast.subject);

      for (const user of activeUsers) {
        if (user.email) {
          try {
            await client.emails.send({
              from: fromEmail,
              to: user.email,
              subject: `LeaseShield Update: ${broadcast.subject}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #14b8a6;">${subjectEscaped}</h2>
                  <p>Hi${user.firstName ? ` ${user.firstName}` : ''},</p>
                  <p>You have a new announcement from LeaseShield:</p>
                  <div style="background-color: #f8f9fa; border-left: 4px solid #14b8a6; padding: 16px; margin: 16px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #374151; line-height: 1.6;">${contentPreview}</p>
                  </div>
                  <p style="margin: 24px 0;">
                    <a href="${baseUrl}/messages" style="background-color: #14b8a6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                      View Full Message in LeaseShield
                    </a>
                  </p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                  <p style="color: #999; font-size: 12px;">
                    LeaseShield - Protecting landlords with legal templates and compliance guidance.
                  </p>
                </div>
              `,
              text: `Hi${user.firstName ? ` ${user.firstName}` : ''},\n\nYou have a new announcement from LeaseShield:\n\n${broadcast.subject}\n\n${rawPreview}\n\nView the full message here: ${baseUrl}/messages\n\nLeaseShield - Protecting landlords with legal templates and compliance guidance.`,
            });
            emailSuccessCount++;
          } catch (emailError) {
            console.error(`Failed to resend broadcast email to ${user.email}:`, emailError);
          }
        }
      }

      console.log(`Resent broadcast "${broadcast.subject}" to ${emailSuccessCount} active subscribers`);
      res.json({ 
        success: true, 
        emailsSent: emailSuccessCount,
        totalActiveSubscribers: activeUsers.length 
      });
    } catch (error) {
      console.error("Error resending broadcast:", error);
      res.status(500).json({ message: "Failed to resend broadcast" });
    }
  });
}
