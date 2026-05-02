import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { emailService } from "../emailService";
import { getUncachableResendClient } from "../resend";
import { getUserId } from "./_shared";

export async function registerAdminScreeningCredentialsRoutes(app: Express) {

  // ===== ADMIN SCREENING CREDENTIALS MANAGEMENT =====

  // Get all landlords with their screening credential status
  app.get('/api/admin/screening-credentials', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const landlordsWithStatus = await storage.getAllLandlordsWithScreeningStatus();
      
      // Map to return safe data (no encrypted passwords)
      const result = landlordsWithStatus.map(({ user, credentials }) => ({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hasCredentials: !!credentials,
        status: credentials?.status || 'not_configured',
        lastVerifiedAt: credentials?.lastVerifiedAt,
        lastErrorMessage: credentials?.lastErrorMessage,
        configuredBy: credentials?.configuredBy,
        configuredAt: credentials?.configuredAt,
        hasInvitationId: !!credentials?.defaultInvitationId,
        invitationId: credentials?.defaultInvitationId || null,
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Error getting landlords with screening status:", error);
      res.status(500).json({ message: "Failed to get landlords" });
    }
  });

  // Set or update screening credentials for a landlord (admin only)
  app.post('/api/admin/screening-credentials/:userId', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const adminId = getUserId(req);
      const { username, password, invitationId } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Encrypt credentials using existing crypto functions
      const { encryptCredentials } = await import("../crypto");
      const { encryptedUsername, encryptedPassword, encryptionIv } = encryptCredentials(username, password);

      // Check if credentials already exist
      const existing = await storage.getLandlordScreeningCredentials(userId);

      if (existing) {
        // Update existing
        await storage.updateLandlordScreeningCredentials(userId, {
          encryptedUsername,
          encryptedPassword,
          encryptionIv,
          defaultInvitationId: invitationId || null,
          status: 'pending_verification',
          configuredBy: adminId,
          configuredAt: new Date(),
        });
        res.json({ success: true, status: 'updated' });
      } else {
        // Create new
        await storage.createLandlordScreeningCredentials({
          userId,
          encryptedUsername,
          encryptedPassword,
          encryptionIv,
          defaultInvitationId: invitationId || undefined,
          status: 'pending_verification',
          configuredBy: adminId,
          configuredAt: new Date(),
        });
        res.json({ success: true, status: 'created' });
      }
    } catch (error) {
      console.error("Error setting screening credentials:", error);
      res.status(500).json({ message: "Failed to set credentials" });
    }
  });

  // Test screening credentials for a landlord (admin only)
  app.post('/api/admin/screening-credentials/:userId/test', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const credentials = await storage.getLandlordScreeningCredentials(userId);
      if (!credentials) {
        return res.status(404).json({ message: "Credentials not found for this landlord" });
      }

      // Decrypt credentials
      const { decryptCredentials } = await import("../crypto");
      const { username, password } = decryptCredentials({
        encryptedUsername: credentials.encryptedUsername,
        encryptedPassword: credentials.encryptedPassword,
        encryptionIv: credentials.encryptionIv,
      });

      // Test with Digital Delve
      const { verifyCredentialsWithParams } = await import("../digitalDelveService");
      const verifyResult = await verifyCredentialsWithParams(username, password);
      const testResult = {
        success: verifyResult.success,
        error: verifyResult.error || verifyResult.message,
      };

      // Update status based on test result
      const wasVerified = credentials.status === 'verified';
      await storage.updateLandlordScreeningCredentials(userId, {
        status: testResult.success ? 'verified' : 'failed',
        lastVerifiedAt: testResult.success ? new Date() : undefined,
        lastErrorMessage: testResult.success ? null : testResult.error,
      });

      // Send email notification to landlord when credentials are newly verified
      if (testResult.success && !wasVerified) {
        const landlord = await storage.getUser(userId);
        if (landlord) {
          const { emailService } = await import("../emailService");
          emailService.sendScreeningReadyNotification(landlord).catch(err => {
            console.error('Failed to send screening ready notification:', err);
          });
        }
      }

      res.json(testResult);
    } catch (error) {
      console.error("Error testing screening credentials:", error);
      res.status(500).json({ message: "Failed to test credentials" });
    }
  });

  // Get all tips for admin preview (admin only)
  app.get('/api/admin/tips', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { LANDLORD_TIPS } = await import("../scheduledJobs");
      
      // Calculate current biweek
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNumber = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const currentBiweek = Math.floor(weekNumber / 2);
      const currentTipIndex = currentBiweek % LANDLORD_TIPS.length;
      
      res.json({
        tips: LANDLORD_TIPS.map((tip, index) => ({
          ...tip,
          index,
          isCurrent: index === currentTipIndex,
        })),
        currentTipIndex,
        currentBiweek,
        totalTips: LANDLORD_TIPS.length,
      });
    } catch (error) {
      console.error("Error fetching tips:", error);
      res.status(500).json({ message: "Failed to fetch tips" });
    }
  });

  // Send a specific tip to admin for preview (admin only)
  app.post('/api/admin/tips/:index/preview', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { LANDLORD_TIPS } = await import("../scheduledJobs");
      const tipIndex = parseInt(req.params.index);
      
      if (isNaN(tipIndex) || tipIndex < 0 || tipIndex >= LANDLORD_TIPS.length) {
        return res.status(400).json({ message: "Invalid tip index" });
      }
      
      const tip = LANDLORD_TIPS[tipIndex];
      const adminId = getUserId(req);
      const admin = await storage.getUser(adminId);
      
      if (!admin?.email) {
        return res.status(400).json({ message: "Admin email not found" });
      }
      
      // Import and use the sendTipEmail function's logic directly
      const { getUncachableResendClient } = await import("../resend");
      const { client, fromEmail } = await getUncachableResendClient();
      
      const firstName = admin.firstName || 'there';
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'https://leaseshieldapp.com';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 24px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                LeaseShield Tip of the Week
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 18px; font-weight: 500;">
                Hi ${firstName},
              </p>
              
              <div style="background-color: #f0fdfa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 8px 0; color: #0d9488; font-size: 18px; font-weight: 600;">
                  ${tip.title}
                </h2>
                <p style="margin: 0; color: #475569; font-size: 14px; font-style: italic;">
                  ${tip.summary}
                </p>
              </div>

              <p style="margin: 0 0 20px 0; color: #334155; font-size: 15px; line-height: 1.7;">
                ${tip.content}
              </p>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Action Item:</strong> ${tip.actionItem}
                </p>
              </div>

              <div style="text-align: center; margin-top: 32px;">
                <a href="${baseUrl}/dashboard" 
                   style="display: inline-block; background-color: #14b8a6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  Go to Dashboard
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                [PREVIEW] This is tip #${tipIndex + 1} of ${LANDLORD_TIPS.length}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      
      await client.emails.send({
        from: fromEmail,
        to: admin.email,
        subject: `[Preview] Tip #${tipIndex + 1}: ${tip.title}`,
        html,
        text: `${tip.title}\n\n${tip.summary}\n\n${tip.content}\n\nAction Item: ${tip.actionItem}`,
      });
      
      res.json({ success: true, message: `Preview sent to ${admin.email}` });
    } catch (error) {
      console.error("Error sending tip preview:", error);
      res.status(500).json({ message: "Failed to send tip preview" });
    }
  });

  // Test biweekly tip email (admin only)
  app.post('/api/admin/test-biweekly-tip', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { scheduledJobs } = await import("../scheduledJobs");
      await scheduledJobs.sendBiweeklyTips();
      res.json({ success: true, message: 'Biweekly tips sent' });
    } catch (error) {
      console.error("Error sending test tip:", error);
      res.status(500).json({ message: "Failed to send test tip" });
    }
  });

  // Delete screening credentials for a landlord (admin only)
  app.delete('/api/admin/screening-credentials/:userId', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const deleted = await storage.deleteLandlordScreeningCredentials(userId);
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting screening credentials:", error);
      res.status(500).json({ message: "Failed to delete credentials" });
    }
  });

  // Set or clear invitation ID for a landlord (admin only) - separate from credentials
  app.patch('/api/admin/screening-credentials/:userId/invitation', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { invitationId } = req.body;
      const adminId = getUserId(req);

      // Check if credentials exist for this landlord
      const credentials = await storage.getLandlordScreeningCredentials(userId);
      if (!credentials) {
        return res.status(404).json({ message: "Landlord has not set up credentials yet" });
      }

      // Allow setting or clearing the invitation ID
      const trimmedId = typeof invitationId === 'string' ? invitationId.trim() : null;
      const wasAlreadySet = !!credentials.defaultInvitationId;
      
      // Update the invitation ID (null to clear)
      await storage.updateLandlordScreeningCredentials(userId, {
        defaultInvitationId: trimmedId || null,
        configuredBy: adminId,
        configuredAt: new Date(),
      });

      // Notify landlord when invitation ID is set (not cleared) and wasn't previously set
      if (trimmedId && !wasAlreadySet) {
        try {
          const landlord = await storage.getUser(userId);
          if (landlord) {
            await emailService.sendScreeningReadyNotification(landlord);
            console.log(`📧 Screening ready notification sent to landlord ${landlord.email}`);
          }
        } catch (notifyError) {
          console.error('Failed to send landlord notification:', notifyError);
        }
      }

      res.json({ success: true, cleared: !trimmedId });
    } catch (error) {
      console.error("Error setting invitation ID:", error);
      res.status(500).json({ message: "Failed to set invitation ID" });
    }
  });
}
