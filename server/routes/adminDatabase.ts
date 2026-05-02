import type { Express } from "express";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { users, rentalSubmissionFiles } from "@shared/schema";
import { db } from "../db";

export async function registerAdminDatabaseRoutes(app: Express) {
  // ============================================
  // ADMIN: DATABASE BACKUP/EXPORT ENDPOINTS
  // ============================================

  // Helper to safely export a table
  const safeExport = async (queryFn: any, tableName: string) => {
    try {
      if (queryFn && typeof queryFn.findMany === 'function') {
        return await queryFn.findMany();
      }
      return [];
    } catch (e) {
      console.warn(`Could not export table ${tableName}:`, e);
      return [];
    }
  };

  // Export all database tables as JSON (admin only)
  app.get('/api/admin/database-export', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const exportData: Record<string, any> = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.email || 'Unknown',
        tables: {}
      };

      // Core user/auth tables
      exportData.tables.users = await safeExport(db.query.users, 'users');
      exportData.tables.refreshTokens = await safeExport(db.query.refreshTokens, 'refreshTokens');
      exportData.tables.states = await safeExport(db.query.states, 'states');
      
      // Templates and compliance
      exportData.tables.templates = await safeExport(db.query.templates, 'templates');
      exportData.tables.templateVersions = await safeExport(db.query.templateVersions, 'templateVersions');
      exportData.tables.complianceCards = await safeExport(db.query.complianceCards, 'complianceCards');
      exportData.tables.applicationComplianceRules = await safeExport(db.query.applicationComplianceRules, 'applicationComplianceRules');
      exportData.tables.legalUpdates = await safeExport(db.query.legalUpdates, 'legalUpdates');
      
      // Notifications and analytics
      exportData.tables.userNotifications = await safeExport(db.query.userNotifications, 'userNotifications');
      exportData.tables.analyticsEvents = await safeExport(db.query.analyticsEvents, 'analyticsEvents');
      
      // Content
      exportData.tables.screeningContent = await safeExport(db.query.screeningContent, 'screeningContent');
      exportData.tables.tenantIssueWorkflows = await safeExport(db.query.tenantIssueWorkflows, 'tenantIssueWorkflows');
      exportData.tables.blogPosts = await safeExport(db.query.blogPosts, 'blogPosts');
      
      // Legislative monitoring
      exportData.tables.legislativeMonitoring = await safeExport(db.query.legislativeMonitoring, 'legislativeMonitoring');
      exportData.tables.caseLawMonitoring = await safeExport(db.query.caseLawMonitoring, 'caseLawMonitoring');
      exportData.tables.templateReviewQueue = await safeExport(db.query.templateReviewQueue, 'templateReviewQueue');
      exportData.tables.monitoringRuns = await safeExport(db.query.monitoringRuns, 'monitoringRuns');
      
      // Property/document management
      exportData.tables.properties = await safeExport(db.query.properties, 'properties');
      exportData.tables.retentionSettings = await safeExport(db.query.retentionSettings, 'retentionSettings');
      exportData.tables.savedDocuments = await safeExport(db.query.savedDocuments, 'savedDocuments');
      exportData.tables.uploadedDocuments = await safeExport(db.query.uploadedDocuments, 'uploadedDocuments');
      
      // Communications and emails
      exportData.tables.communicationTemplates = await safeExport(db.query.communicationTemplates, 'communicationTemplates');
      exportData.tables.broadcastMessages = await safeExport(db.query.broadcastMessages, 'broadcastMessages');
      exportData.tables.broadcastRecipients = await safeExport(db.query.broadcastRecipients, 'broadcastRecipients');
      exportData.tables.broadcastReplies = await safeExport(db.query.broadcastReplies, 'broadcastReplies');
      exportData.tables.emailSequences = await safeExport(db.query.emailSequences, 'emailSequences');
      exportData.tables.emailSequenceSteps = await safeExport(db.query.emailSequenceSteps, 'emailSequenceSteps');
      exportData.tables.emailSequenceEnrollments = await safeExport(db.query.emailSequenceEnrollments, 'emailSequenceEnrollments');
      exportData.tables.emailEvents = await safeExport(db.query.emailEvents, 'emailEvents');
      
      // Rent ledger
      exportData.tables.rentLedgerEntries = await safeExport(db.query.rentLedgerEntries, 'rentLedgerEntries');
      exportData.tables.trainingInterest = await safeExport(db.query.trainingInterest, 'trainingInterest');
      
      // Rental application system
      exportData.tables.rentalProperties = await safeExport(db.query.rentalProperties, 'rentalProperties');
      exportData.tables.rentalUnits = await safeExport(db.query.rentalUnits, 'rentalUnits');
      exportData.tables.rentalApplicationLinks = await safeExport(db.query.rentalApplicationLinks, 'rentalApplicationLinks');
      exportData.tables.rentalSubmissions = await safeExport(db.query.rentalSubmissions, 'rentalSubmissions');
      exportData.tables.rentalSubmissionPeople = await safeExport(db.query.rentalSubmissionPeople, 'rentalSubmissionPeople');
      exportData.tables.rentalSubmissionFiles = await safeExport(db.query.rentalSubmissionFiles, 'rentalSubmissionFiles');
      exportData.tables.rentalSubmissionAcknowledgements = await safeExport(db.query.rentalSubmissionAcknowledgements, 'rentalSubmissionAcknowledgements');
      exportData.tables.rentalScreeningOrders = await safeExport(db.query.rentalScreeningOrders, 'rentalScreeningOrders');
      exportData.tables.rentalDecisions = await safeExport(db.query.rentalDecisions, 'rentalDecisions');
      
      // Count records
      let totalRecords = 0;
      for (const tableName of Object.keys(exportData.tables)) {
        totalRecords += exportData.tables[tableName]?.length || 0;
      }
      exportData.totalRecords = totalRecords;
      exportData.tableCount = Object.keys(exportData.tables).length;

      res.json(exportData);
    } catch (error) {
      console.error("Error exporting database:", error);
      res.status(500).json({ message: "Failed to export database" });
    }
  });

  // Get list of tables and their record counts (admin only)
  app.get('/api/admin/database-stats', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const stats: { name: string; count: number }[] = [];
      
      // Build list of all table names to query stats for
      const tableNames = [
        'users', 'refreshTokens', 'states', 'templates', 'templateVersions',
        'complianceCards', 'applicationComplianceRules', 'legalUpdates',
        'userNotifications', 'analyticsEvents', 'screeningContent',
        'tenantIssueWorkflows', 'blogPosts', 'legislativeMonitoring',
        'caseLawMonitoring', 'templateReviewQueue', 'monitoringRuns',
        'properties', 'retentionSettings', 'savedDocuments', 'uploadedDocuments',
        'communicationTemplates', 'broadcastMessages', 'broadcastRecipients',
        'broadcastReplies', 'emailSequences', 'emailSequenceSteps',
        'emailSequenceEnrollments', 'emailEvents', 'rentLedgerEntries',
        'trainingInterest', 'rentalProperties', 'rentalUnits',
        'rentalApplicationLinks', 'rentalSubmissions', 'rentalSubmissionPeople',
        'rentalSubmissionFiles', 'rentalSubmissionAcknowledgements',
        'rentalScreeningOrders', 'rentalDecisions'
      ];

      for (const tableName of tableNames) {
        try {
          const queryFn = (db.query as any)[tableName];
          if (queryFn && typeof queryFn.findMany === 'function') {
            const records = await queryFn.findMany();
            stats.push({ name: tableName, count: records?.length || 0 });
          } else {
            stats.push({ name: tableName, count: 0 });
          }
        } catch (e) {
          stats.push({ name: tableName, count: 0 });
        }
      }

      res.json({ 
        stats, 
        totalRecords: stats.reduce((sum, s) => sum + s.count, 0),
        tableCount: stats.length 
      });
    } catch (error) {
      console.error("Error getting database stats:", error);
      res.status(500).json({ message: "Failed to get database stats" });
    }
  });
}
