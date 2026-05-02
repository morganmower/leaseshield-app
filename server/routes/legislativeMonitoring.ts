import type { Express } from "express";
import { eq, desc } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { db } from "../db";
import { getUserId } from "./_shared";

export async function registerLegislativeMonitoringRoutes(app: Express) {
  // Get monitoring run history (admin only)
  app.get('/api/admin/monitoring-runs', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const runs = await storage.getRecentMonitoringRuns(limit);
      res.json(runs);
    } catch (error) {
      console.error('Error fetching monitoring runs:', error);
      res.status(500).json({ message: 'Failed to fetch runs' });
    }
  });

  // Get last successful monitoring run (admin only)
  app.get('/api/admin/monitoring-status', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { getLockStatus } = await import("../utils/jobLock");
      const lockStatus = getLockStatus();

      const lastRun = await storage.getLastSuccessfulMonitoringRun();
      const hasRunThisMonth = await storage.hasMonitoringRunThisMonth();
      
      res.json({
        lastRun: lastRun || null,
        hasRunThisMonth,
        nextScheduledDay: 1, // Runs on the 1st of each month
        jobInProgress: lockStatus.locked,
        currentJob: lockStatus.job,
        jobStartedAt: lockStatus.since,
      });
    } catch (error) {
      console.error('Error fetching monitoring status:', error);
      res.status(500).json({ message: 'Failed to fetch status' });
    }
  });

  // Legislative Monitoring Orchestrator (admin only)
  // Modes: queueOnly (default), ingestOnly, publishApproved
  // Returns immediately (async job) - poll /api/admin/monitoring-status for progress
  app.post('/api/admin/legislative-monitoring/run', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const mode = String(req.query.mode || 'queueOnly').toLowerCase();
      const validModes = ['queueonly', 'ingestonly', 'publishapproved'];
      
      if (!validModes.includes(mode)) {
        return res.status(400).json({
          success: false,
          error: `Invalid mode "${mode}". Valid modes: queueOnly, ingestOnly, publishApproved`,
        });
      }

      const { tryAcquireLock, releaseLock, getLockStatus } = await import("../utils/jobLock");
      
      // Try to acquire lock synchronously before responding
      const lockAcquired = tryAcquireLock('legislative-monitoring');
      
      if (!lockAcquired) {
        const lockStatus = getLockStatus();
        return res.status(409).json({
          success: false,
          error: 'A monitoring job is already running',
          currentJob: lockStatus.job,
          lockedSince: lockStatus.since,
        });
      }

      // Lock acquired - wrap everything in try/catch to ensure lock release on failure
      let legislativeMonitoringService: any;
      try {
        const module = await import("../legislativeMonitoringService");
        legislativeMonitoringService = module.legislativeMonitoringService;
      } catch (importErr) {
        releaseLock('legislative-monitoring');
        throw importErr;
      }

      console.log(`📋 Legislative monitoring run triggered by ${user.email} (mode: ${mode})`);

      // Run job in background (lock already acquired)
      (async () => {
        try {
          if (mode === 'ingestonly') {
            await legislativeMonitoringService.ingestNow();
            return;
          }

          if (mode === 'publishapproved') {
            await legislativeMonitoringService.ingestNow();
            await legislativeMonitoringService.publishApproved();
            return;
          }

          // Default: queueOnly (safe)
          await legislativeMonitoringService.ingestNow();
          await legislativeMonitoringService.queueFromLatestIngest();
        } catch (err) {
          console.error('Background monitoring job failed:', err);
        } finally {
          releaseLock('legislative-monitoring');
        }
      })();

      // Return immediately - lock is confirmed acquired
      return res.json({ 
        success: true, 
        mode, 
        message: 'Monitoring job started. Poll /api/admin/monitoring-status to track progress.',
        async: true,
      });
    } catch (err: any) {
      // Ensure lock is released if we somehow get here with lock held
      const { releaseLock } = await import("../utils/jobLock");
      releaseLock('legislative-monitoring');
      console.error('Error starting legislative monitoring run:', err);
      return res.status(500).json({ 
        success: false, 
        error: err?.message || 'Unknown error',
      });
    }
  });

  // Re-analyze existing bills to populate compliance categories (admin only)
  app.post('/api/admin/legislative-monitoring/reanalyze', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log('🔄 Re-analyzing existing bills for compliance categories...');
      
      // Get all bills that don't have compliance categories
      const allBills = await storage.getAllLegislativeMonitoring({});
      const billsToReanalyze = allBills.filter(b => 
        !b.affectedComplianceCategories || b.affectedComplianceCategories.length === 0
      );

      console.log(`Found ${billsToReanalyze.length} bills to re-analyze`);

      // Import the analysis service
      const { BillAnalysisService } = await import("../billAnalysisService");
      const analysisService = new BillAnalysisService();

      let updated = 0;
      for (const bill of billsToReanalyze) {
        try {
          // Use fallback analysis (faster, no API calls)
          // Safely build analysis text with null-guarding
          const text = [
            bill.title || '',
            bill.description || '',
            bill.aiAnalysis || ''
          ].join(' ').toLowerCase();
          
          const categoryKeywords: Record<string, string[]> = {
            rent_increases: [
              'rent increase', 'rent control', 'rent cap', 'rent stabilization',
              'rent limit', 'rental increase', 'rent notice', 'rent raise',
              'tenant protection act', 'just cause', 'rent regulation',
            ],
            deposits: [
              'security deposit', 'deposit return', 'deposit limit', 'deposit refund',
            ],
            evictions: [
              'eviction', 'unlawful detainer', 'lease termination', 'notice to quit',
              'eviction moratorium', 'eviction protection',
            ],
            disclosures: [
              'disclosure', 'lead paint', 'mold disclosure', 'bed bug',
            ],
            fair_housing: [
              'fair housing', 'discrimination', 'protected class', 'source of income',
              'housing discrimination', 'reasonable accommodation',
            ],
          };

          const affectedCategories: string[] = [];
          for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(k => text.includes(k))) {
              affectedCategories.push(category);
            }
          }

          if (affectedCategories.length > 0) {
            // Use bill.id (primary key) not bill.billId (source system ID)
            await storage.updateLegislativeMonitoring(bill.id, {
              affectedComplianceCategories: affectedCategories,
            });
            updated++;
            console.log(`  Updated ${bill.billNumber}: ${affectedCategories.join(', ')}`);
          }
        } catch (err) {
          console.error(`Error re-analyzing bill ${bill.id}:`, err);
        }
      }

      console.log(`✅ Re-analysis complete. Updated ${updated} bills with compliance categories.`);

      return res.json({
        success: true,
        message: `Re-analyzed ${billsToReanalyze.length} bills, updated ${updated} with compliance categories`,
        analyzed: billsToReanalyze.length,
        updated,
      });
    } catch (error) {
      console.error('Error re-analyzing bills:', error);
      return res.status(500).json({ 
        success: false,
        message: "Something went wrong. Please try again."
      });
    }
  });

  // Ingest only endpoint (admin only) - with job lock
  app.post('/api/admin/legislative-monitoring/ingest', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log('🌙 Ingest triggered by admin:', user.email);
      
      const { withJobLock } = await import("../utils/jobLock");
      const { legislativeMonitoringService } = await import("../legislativeMonitoringService");

      const result = await withJobLock('legislative-monitoring', async () => {
        return await legislativeMonitoringService.ingestNow();
      });

      return res.json({ success: true, result });
    } catch (err: any) {
      console.error('Error running legislative ingest:', err);
      const status = err?.status || 500;
      return res.status(status).json({ 
        success: false, 
        error: err?.message || 'Unknown error',
        currentJob: err?.currentJob,
        lockedSince: err?.lockedSince,
      });
    }
  });

  // Publish approved only endpoint (admin only) - with job lock and approval gate
  app.post('/api/admin/legislative-monitoring/publish', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      console.log('📦 Publish approved triggered by admin:', user.email);
      
      const { withJobLock } = await import("../utils/jobLock");
      const { legislativeMonitoringService } = await import("../legislativeMonitoringService");

      const result = await withJobLock('legislative-monitoring', async () => {
        return await legislativeMonitoringService.publishApproved();
      });

      return res.json({ success: true, result });
    } catch (err: any) {
      console.error('Error running legislative publish:', err);
      const status = err?.status || 500;
      return res.status(status).json({ 
        success: false, 
        error: err?.message || 'Unknown error',
        currentJob: err?.currentJob,
        lockedSince: err?.lockedSince,
      });
    }
  });

  // Get legislative source status (admin only)
  app.get('/api/admin/legislative-sources', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { legislationSources, sourceRuns, releaseBatches } = await import('@shared/schema');
      const { db } = await import("../db");
      const { desc, eq } = await import('drizzle-orm');

      const sources = await db.select().from(legislationSources);
      const recentRuns = await db.select()
        .from(sourceRuns)
        .orderBy(desc(sourceRuns.startedAt))
        .limit(50);
      const recentBatches = await db.select()
        .from(releaseBatches)
        .orderBy(desc(releaseBatches.startedAt))
        .limit(10);

      return res.json({
        sources,
        recentRuns,
        recentBatches,
      });
    } catch (error) {
      console.error('Error fetching legislative sources:', error);
      return res.status(500).json({ message: 'Failed to fetch sources' });
    }
  });

  // Automated cron endpoint for legislative monitoring (protected by secret key)
  app.post('/api/cron/legislative-monitoring', async (req, res) => {
    try {
      // Verify cron secret to prevent unauthorized triggers
      const cronSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';
      
      if (cronSecret !== expectedSecret) {
        console.warn('⚠️ Unauthorized cron attempt - invalid secret');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      console.log('🔄 Running scheduled legislative monitoring...');
      
      const { legislativeMonitoringService } = await import("../legislativeMonitoringService");
      legislativeMonitoringService.runMonthlyMonitoring().catch(err => {
        console.error('Background cron monitoring error:', err);
      });

      console.log('✅ Scheduled monitoring started');
      return res.json({
        success: true,
        message: 'Scheduled monitoring started',
      });
    } catch (error) {
      console.error('❌ Cron monitoring failed:', error);
      return res.status(500).json({ 
        success: false,
        message: "Something went wrong. Please try again."
      });
    }
  });
}
