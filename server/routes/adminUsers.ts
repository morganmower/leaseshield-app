import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin, startImpersonation, stopImpersonation, getImpersonationStatus } from "../jwtAuth";
import { users } from "@shared/schema";
import { getUserId } from "./_shared";

export async function registerAdminUsersRoutes(app: Express) {

  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }

      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Start impersonating a user
  app.post('/api/admin/impersonate/:userId', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const realAdmin = req.realAdmin || req.user;
      const targetUserId = req.params.userId;
      
      // Can't impersonate yourself
      if (targetUserId === realAdmin.id) {
        return res.status(400).json({ message: "Cannot impersonate yourself" });
      }
      
      // Verify target user exists
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Start impersonation
      startImpersonation(realAdmin.id, targetUserId);
      
      console.log(`🎭 Admin ${realAdmin.email} started impersonating ${targetUser.email}`);
      
      res.json({ 
        success: true, 
        impersonating: { 
          id: targetUser.id, 
          email: targetUser.email,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
        }
      });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(500).json({ message: "Failed to start impersonation" });
    }
  });

  // Admin: Stop impersonating
  app.post('/api/admin/stop-impersonating', isAuthenticated, async (req: any, res) => {
    try {
      const realAdmin = req.realAdmin || req.user;
      
      if (!realAdmin.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      stopImpersonation(realAdmin.id);
      
      console.log(`🎭 Admin ${realAdmin.email} stopped impersonating`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // Admin: Get current impersonation status
  app.get('/api/admin/impersonation-status', isAuthenticated, async (req: any, res) => {
    try {
      const realAdmin = req.realAdmin || req.user;
      
      if (!realAdmin.isAdmin) {
        return res.json({ isImpersonating: false });
      }
      
      const status = getImpersonationStatus(realAdmin.id);
      
      if (status) {
        const impersonatedUser = await storage.getUser(status.impersonatedUserId);
        return res.json({
          isImpersonating: true,
          impersonating: impersonatedUser ? {
            id: impersonatedUser.id,
            email: impersonatedUser.email,
            firstName: impersonatedUser.firstName,
            lastName: impersonatedUser.lastName,
          } : null,
          startedAt: status.startedAt,
        });
      }
      
      res.json({ isImpersonating: false });
    } catch (error) {
      console.error("Error getting impersonation status:", error);
      res.status(500).json({ message: "Failed to get impersonation status" });
    }
  });
}
