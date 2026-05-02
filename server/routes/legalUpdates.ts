import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAccess } from "../jwtAuth";

export async function registerLegalUpdatesRoutes(app: Express) {
  // Legal updates routes
  app.get('/api/legal-updates', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const { stateId } = req.query;
      if (!stateId) {
        return res.status(400).json({ message: "stateId is required" });
      }
      
      let updates;
      
      if (stateId === 'NATIONAL') {
        // Get all legal updates including federal
        updates = await storage.getAllLegalUpdates();
      } else {
        // Get state-specific updates AND federal (US) updates - they apply to all states
        const stateUpdates = await storage.getLegalUpdatesByState(stateId as string);
        const federalUpdates = await storage.getLegalUpdatesByState('US');
        updates = [...stateUpdates, ...federalUpdates];
      }
      
      // Also fetch recent legislative monitoring records (high/medium relevance) for this state(s)
      // Federal Register documents (stateId='US') should appear for ALL states
      let legislativeUpdates: any[] = [];
      if (stateId === 'NATIONAL') {
        const allBills = await storage.getAllLegislativeMonitoring({});
        legislativeUpdates = allBills.filter(b => b.relevanceLevel === 'high' || b.relevanceLevel === 'medium');
      } else {
        // Get state-specific bills
        const stateBills = await storage.getAllLegislativeMonitoring({ stateId: stateId as string });
        // Also get federal documents (US) - they apply to all states
        const federalBills = await storage.getAllLegislativeMonitoring({ stateId: 'US' });
        const allBills = [...stateBills, ...federalBills];
        legislativeUpdates = allBills.filter(b => b.relevanceLevel === 'high' || b.relevanceLevel === 'medium');
      }
      
      // Combine and sort by effective date (most recent first), fallback to createdAt
      const combined = [
        ...updates.map(u => ({ ...u, type: 'legal_update' })),
        ...legislativeUpdates.map(b => ({ 
          ...b, 
          type: 'legislative_update',
          impactLevel: b.relevanceLevel,
          // Map legislative fields to legal update format for UI display
          title: b.title || b.billNumber,
          summary: b.description || `Bill: ${b.billNumber}`,
          whyItMatters: b.aiAnalysis || 'This bill affects landlord-tenant law in your state.',
          beforeText: b.lastAction || 'Bill pending',
          afterText: `${b.billNumber}: ${b.title}`,
          effectiveDate: b.lastActionDate || b.createdAt
        }))
      ].sort((a, b) => {
        // Sort by effectiveDate first, then by createdAt as fallback
        const dateA = a.effectiveDate ? new Date(a.effectiveDate).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.effectiveDate ? new Date(b.effectiveDate).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA; // Most recent first
      });
      
      // Mark items added/effective within the last 90 days as "isRecent" for UI highlighting
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const result = combined.map((item, index) => {
        const itemDate = item.effectiveDate ? new Date(item.effectiveDate) : new Date(item.createdAt);
        return {
          ...item,
          isNewest: index === 0,
          isRecent: itemDate >= ninetyDaysAgo,
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching legal updates:", error);
      res.status(500).json({ message: "Failed to fetch legal updates" });
    }
  });
}
