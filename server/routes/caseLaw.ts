import type { Express } from "express";
import { eq, desc } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { users } from "@shared/schema";
import { db } from "../db";
import { getUserId } from "./_shared";

export async function registerCaseLawRoutes(app: Express) {
  // Get case law for authenticated users (filtered by relevance and state)
  app.get('/api/case-law', isAuthenticated, async (req: any, res) => {
    try {
      const { stateId } = req.query;
      if (!stateId) {
        return res.status(400).json({ message: "stateId required" });
      }
      
      let cases;
      if (stateId === 'NATIONAL') {
        cases = await db.query.caseLawMonitoring.findMany({
          where: (table) => eq(table.isMonitored, true),
          limit: 100,
          orderBy: (table) => [desc(table.dateFiled)],
        });
      } else {
        cases = await db.query.caseLawMonitoring.findMany({
          where: (table, { eq, and }) => and(
            eq(table.stateId, stateId as string),
            eq(table.isMonitored, true),
          ),
          limit: 50,
          orderBy: (table) => [desc(table.dateFiled)],
        });
      }

      // Filter to only high/medium relevance cases for user display
      const relevantCases = cases.filter(c => c.relevanceLevel === 'high' || c.relevanceLevel === 'medium');
      res.json(relevantCases);
    } catch (error) {
      console.error('Error fetching case law:', error);
      res.status(500).json({ message: 'Failed to fetch case law' });
    }
  });

  app.get('/api/admin/case-law', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const filters: any = {};
      if (req.query.stateId) filters.stateId = req.query.stateId as string;
      if (req.query.relevanceLevel) filters.relevanceLevel = req.query.relevanceLevel as string;
      if (req.query.isReviewed !== undefined) filters.isReviewed = req.query.isReviewed === 'true';

      const cases = await storage.getAllCaseLawMonitoring(filters);
      res.json(cases);
    } catch (error) {
      console.error('Error fetching case law:', error);
      res.status(500).json({ message: 'Failed to fetch case law' });
    }
  });

  // Test CourtListener API (admin only) - for debugging
  app.get('/api/admin/case-law/test', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);

      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const stateId = (req.query.stateId as string) || 'UT';
      const daysBack = parseInt(req.query.daysBack as string) || 60;

      const { courtListenerService } = await import("../courtListenerService");
      
      console.log(`🧪 Testing CourtListener API for ${stateId} (${daysBack} days back)`);
      const results = await courtListenerService.searchCases(stateId, [], daysBack);

      if (!results) {
        return res.json({
          success: false,
          message: 'CourtListener API returned no results (check API key)',
          stateId,
          daysBack,
          apiKeySet: !!process.env.COURTLISTENER_API_KEY,
        });
      }

      res.json({
        success: true,
        stateId,
        daysBack,
        totalCount: results.meta.total_count,
        resultsReturned: results.results.length,
        cases: results.results.slice(0, 5).map(c => ({
          id: c.id,
          caseName: c.case_name,
          dateFiled: c.date_filed,
          court: c.court,
        })),
      });
    } catch (error) {
      console.error('Error testing CourtListener:', error);
      res.status(500).json({ message: 'Failed to test CourtListener API', error: String(error) });
    }
  });

  app.post('/api/admin/case-law/refresh', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const daysBack = parseInt(req.query.daysBack as string) || 180;
      const stateId = req.query.stateId as string | undefined;

      const { courtListenerService } = await import("../courtListenerService");
      
      console.log(`⚖️ Admin triggered case law refresh (daysBack=${daysBack}, state=${stateId || 'all'})`);
      const result = await courtListenerService.refreshCaseLaw({
        daysBack,
        states: stateId ? [stateId] : undefined,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('Error refreshing case law:', error);
      res.status(500).json({ message: 'Failed to refresh case law', error: String(error) });
    }
  });
}
