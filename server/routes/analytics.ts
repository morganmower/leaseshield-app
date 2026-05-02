import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { getUserId } from "./_shared";

export async function registerAnalyticsRoutes(app: Express) {
  // Analytics routes
  app.post('/api/analytics/track', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { eventType, eventData } = req.body;
      await storage.trackEvent({
        userId,
        eventType,
        eventData,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking analytics event:", error);
      res.status(500).json({ message: "Failed to track event" });
    }
  });

  // Admin analytics
  app.get('/api/admin/analytics', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const summary = await storage.getAnalyticsSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Detailed engagement events with user info for drill-down
  app.get('/api/admin/analytics/engagement', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { eventType, limit, month, year } = req.query;
      const events = await storage.getDetailedEngagementEvents({
        eventType: eventType as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
      });
      res.json(events);
    } catch (error) {
      console.error("Error fetching engagement details:", error);
      res.status(500).json({ message: "Failed to fetch engagement details" });
    }
  });
  
  // Monthly engagement summary for yearly aggregation
  app.get('/api/admin/analytics/engagement/monthly', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { year } = req.query;
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const summary = await storage.getEngagementSummaryByMonth(targetYear);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching monthly engagement summary:", error);
      res.status(500).json({ message: "Failed to fetch monthly engagement summary" });
    }
  });
}
