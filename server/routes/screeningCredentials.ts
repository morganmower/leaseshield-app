import type { Express } from "express";
import crypto from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../jwtAuth";
import { users } from "@shared/schema";
import { emailService } from "../emailService";
import { getUserId } from "./_shared";

export async function registerScreeningCredentialsRoutes(app: Express) {
  // Import crypto helper for credentials
  const { encryptCredentials, decryptCredentials } = await import("../crypto");
  const { verifyCredentialsWithParams, retrieveInvitations } = await import("../digitalDelveService");
  
  // Schema for credential input (landlord only sets username/password, admin sets invitation ID)
  const screeningCredentialsSchema = z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(100),
  });
  
  // Test credentials with Western Verify (no save)
  app.post('/api/screening-credentials/test', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = screeningCredentialsSchema.parse(req.body);
      
      // Test authentication with Western Verify
      const result = await verifyCredentialsWithParams(validatedData.username, validatedData.password);
      
      if (result.success) {
        // Also fetch invitations to return them
        const invitationsResult = await retrieveInvitations({ 
          username: validatedData.username, 
          password: validatedData.password 
        });
        
        res.json({
          success: true,
          message: "Credentials verified successfully",
          invitations: invitationsResult.success ? invitationsResult.invitations : [],
        });
      } else {
        res.json({
          success: false,
          message: result.error || "Invalid credentials",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Invalid input data" });
      }
      console.error("Error testing screening credentials:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });
  
  // Save credentials (encrypted)
  app.post('/api/screening-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const validatedData = screeningCredentialsSchema.parse(req.body);
      
      // Test credentials first
      const testResult = await verifyCredentialsWithParams(validatedData.username, validatedData.password);
      
      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          message: testResult.error || "Invalid credentials - please verify your Western Verify login details",
        });
      }
      
      // Encrypt credentials
      const encrypted = encryptCredentials(validatedData.username, validatedData.password);
      
      // Check if credentials already exist for this user
      const existing = await storage.getLandlordScreeningCredentials(userId);
      
      if (existing) {
        // Update existing credentials (preserve admin-set invitation ID)
        const updated = await storage.updateLandlordScreeningCredentials(userId, {
          encryptedUsername: encrypted.encryptedUsername,
          encryptedPassword: encrypted.encryptedPassword,
          encryptionIv: encrypted.encryptionIv,
          status: 'verified',
          lastVerifiedAt: new Date(),
          lastErrorMessage: null,
        });
        
        res.json({
          success: true,
          message: "Screening credentials updated successfully",
          status: updated?.status,
        });
      } else {
        // Create new credentials (admin will set invitation ID separately)
        await storage.createLandlordScreeningCredentials({
          userId,
          encryptedUsername: encrypted.encryptedUsername,
          encryptedPassword: encrypted.encryptedPassword,
          encryptionIv: encrypted.encryptionIv,
          status: 'verified',
          lastVerifiedAt: new Date(),
        });
        
        // Notify admin that a landlord is waiting for invitation ID setup
        try {
          const landlord = await storage.getUser(userId);
          const allUsers = await storage.getAllUsers();
          const adminEmails = allUsers.filter(u => u.isAdmin && u.email).map(u => u.email!);
          
          if (landlord && adminEmails.length > 0) {
            await emailService.sendScreeningCredentialsSetupNotification(landlord, adminEmails);
            console.log(`📧 Admin notification sent for landlord ${landlord.email} credentials setup`);
          }
        } catch (notifyError) {
          console.error('Failed to send admin notification:', notifyError);
          // Don't fail the credential save if notification fails
        }
        
        res.json({
          success: true,
          message: "Screening credentials saved successfully. An administrator will complete your setup shortly.",
          status: 'verified',
          pendingAdminSetup: true,
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: "Invalid input data" });
      }
      console.error("Error saving screening credentials:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });
  
  // Get credential status (never returns actual credentials)
  app.get('/api/screening-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const credentials = await storage.getLandlordScreeningCredentials(userId);
      
      if (!credentials) {
        return res.json({
          configured: false,
          status: 'not_configured',
          integrationReady: false,
        });
      }
      
      // Integration is ready when credentials are verified AND invitation ID is set
      const integrationReady = credentials.status === 'verified' && !!credentials.defaultInvitationId;
      const pendingAdminSetup = credentials.status === 'verified' && !credentials.defaultInvitationId;
      
      res.json({
        configured: true,
        status: credentials.status,
        lastVerifiedAt: credentials.lastVerifiedAt,
        lastErrorMessage: credentials.lastErrorMessage,
        hasDefaultInvitation: !!credentials.defaultInvitationId,
        defaultInvitationId: credentials.defaultInvitationId || null,
        integrationReady,
        pendingAdminSetup,
      });
    } catch (error) {
      console.error("Error getting screening credentials:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });
  
  // Delete credentials
  app.delete('/api/screening-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const deleted = await storage.deleteLandlordScreeningCredentials(userId);
      
      res.json({
        success: deleted,
        message: deleted ? "Screening credentials removed" : "No credentials found",
      });
    } catch (error) {
      console.error("Error deleting screening credentials:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });
  
  // Get invitations for current credentials
  app.get('/api/screening-credentials/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const credentials = await storage.getLandlordScreeningCredentials(userId);
      
      if (!credentials) {
        return res.status(400).json({
          success: false,
          message: "No screening credentials configured",
        });
      }
      
      // Decrypt credentials
      const decrypted = decryptCredentials({
        encryptedUsername: credentials.encryptedUsername,
        encryptedPassword: credentials.encryptedPassword,
        encryptionIv: credentials.encryptionIv,
      });
      
      const result = await retrieveInvitations({ 
        username: decrypted.username, 
        password: decrypted.password 
      });
      
      if (result.success) {
        res.json({
          success: true,
          invitations: result.invitations,
          defaultInvitationId: credentials.defaultInvitationId,
        });
      } else {
        res.json({
          success: false,
          message: result.error || "Failed to retrieve invitations",
        });
      }
    } catch (error) {
      console.error("Error getting screening invitations:", error);
      res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
  });

  // AI Training Interest - track users who want to be notified about workshops
  app.post('/api/training-interest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user already registered interest
      const existingInterest = await storage.getTrainingInterest(userId);
      if (existingInterest) {
        return res.json({ message: "Already registered", interest: existingInterest });
      }
      
      // Save the interest with user's email for easy export
      const interest = await storage.createTrainingInterest({
        userId,
        email: user.email || undefined,
      });
      
      res.json({ message: "Successfully registered for notifications", interest });
    } catch (error) {
      console.error("Error saving training interest:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Check if user has registered training interest
  app.get('/api/training-interest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const interest = await storage.getTrainingInterest(userId);
      res.json({ registered: !!interest, interest });
    } catch (error) {
      console.error("Error checking training interest:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });
}
