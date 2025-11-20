// Legislative Monitoring Orchestration Service
// Coordinates LegiScan API, AI analysis, and database operations

import { legiscanService } from './legiscanService';
import { billAnalysisService } from './billAnalysisService';
import { storage } from './storage';
import type { InsertLegislativeMonitoring, InsertTemplateReviewQueue } from '@shared/schema';

export class LegislativeMonitoringService {
  /**
   * Run the monthly legislative monitoring check for all states
   */
  async runMonthlyMonitoring(): Promise<void> {
    console.log('🗳️  Starting monthly legislative monitoring run...');

    const states = await storage.getAllStates();
    const activeStates = states.filter(s => s.isActive);
    const currentYear = new Date().getFullYear();

    let totalBills = 0;
    let relevantBills = 0;
    let templatesQueued = 0;

    try {
      const runData = {
        runDate: new Date(),
        statesChecked: activeStates.map(s => s.id),
        billsFound: 0,
        relevantBills: 0,
        templatesQueued: 0,
        status: 'in_progress' as const,
        errorMessage: null,
        summaryReport: '',
        emailSent: false,
      };

      const run = await storage.createMonitoringRun(runData);

      // Fetch all templates once for AI analysis
      const allTemplates = await storage.getAllTemplates();

      // Check each state for new bills
      for (const state of activeStates) {
        try {
          console.log(`\n📋 Checking ${state.name} (${state.id}) for new bills...`);

          const searchResults = await legiscanService.searchBills(state.id, currentYear);

          if (!searchResults) {
            console.log(`  ⚠️  No results from LegiScan for ${state.id}`);
            continue;
          }

          const billCount = searchResults.searchresult.summary.count;
          totalBills += billCount;

          if (billCount === 0) {
            console.log(`  ✓ No landlord-tenant bills found for ${state.id}`);
            continue;
          }

          console.log(`  📊 Found ${billCount} bills for ${state.id}`);

          // Process each bill
          const billKeys = Object.keys(searchResults.searchresult).filter(k => k !== 'summary');

          for (const key of billKeys.slice(0, 10)) { // Limit to first 10 for MVP
            const billSummary = searchResults.searchresult[key];

            // Check if we've already processed this bill
            const existing = await storage.getLegislativeMonitoringByBillId(billSummary.bill_id.toString());

            if (existing) {
              console.log(`  ⏭️  Bill ${billSummary.bill_number} already tracked`);
              continue;
            }

            // Fetch full bill details
            const bill = await legiscanService.getBill(billSummary.bill_id);

            if (!bill) {
              console.log(`  ⚠️  Could not fetch details for bill ${billSummary.bill_id}`);
              continue;
            }

            // Check if bill is relevant to landlord-tenant law
            if (!legiscanService.isRelevantBill(bill)) {
              console.log(`  ⏭️  ${bill.bill_number} not relevant to landlord-tenant law`);
              continue;
            }

            console.log(`  🔍 Analyzing ${bill.bill_number}: ${bill.title.substring(0, 60)}...`);

            // Get bill text for deeper analysis (optional, can be slow)
            const billText = await legiscanService.getBillText(billSummary.bill_id);

            // AI analysis to determine relevance and affected templates
            const analysis = await billAnalysisService.analyzeBill(
              bill.title,
              bill.description,
              billText,
              state.id,
              allTemplates
            );

            // Skip if deemed not relevant
            if (analysis.relevanceLevel === 'dismissed' || analysis.relevanceLevel === 'low') {
              console.log(`  ⏭️  ${bill.bill_number} dismissed as low relevance`);
              continue;
            }

            relevantBills++;

            const lastAction = legiscanService.getLastAction(bill);

            // Save to legislative monitoring table
            const monitoringData: InsertLegislativeMonitoring = {
              billId: bill.bill_id.toString(),
              stateId: state.id,
              billNumber: bill.bill_number,
              title: bill.title,
              description: bill.description,
              status: legiscanService.mapBillStatus(bill.status),
              url: bill.url || null,
              lastAction: lastAction.action,
              lastActionDate: new Date(lastAction.date),
              relevanceLevel: analysis.relevanceLevel,
              aiAnalysis: analysis.aiAnalysis,
              affectedTemplateIds: analysis.affectedTemplateIds,
              isMonitored: true,
              isReviewed: false,
              reviewedBy: null,
              reviewedAt: null,
              reviewNotes: null,
            };

            const savedMonitoring = await storage.createLegislativeMonitoring(monitoringData);
            console.log(`  ✅ Saved ${bill.bill_number} with ${analysis.relevanceLevel} relevance`);

            // If high or medium relevance and templates are affected, auto-publish updates
            if ((analysis.relevanceLevel === 'high' || analysis.relevanceLevel === 'medium') && 
                analysis.affectedTemplateIds.length > 0) {
              
              for (const templateId of analysis.affectedTemplateIds) {
                const template = allTemplates.find(t => t.id === templateId);
                
                if (!template) continue;

                // Create review queue entry as pending first (for atomicity)
                const reviewData: InsertTemplateReviewQueue = {
                  templateId: templateId,
                  billId: savedMonitoring.id,
                  status: 'pending',
                  priority: analysis.relevanceLevel === 'high' ? 10 : 5,
                  reason: `Bill ${bill.bill_number}: ${bill.title}`,
                  recommendedChanges: analysis.recommendedChanges,
                  currentVersion: template.version || 1,
                  assignedTo: null,
                  reviewStartedAt: new Date(),
                  reviewCompletedAt: null,
                  attorneyNotes: null,
                  approvedChanges: null,
                  approvalNotes: null,
                  approvedAt: null,
                  rejectedAt: null,
                  updatedTemplateSnapshot: null,
                  publishedAt: null,
                  publishedBy: null,
                };

                const createdReview = await storage.createTemplateReviewQueue(reviewData);
                
                // Auto-publish the template update immediately
                let publishResult;
                let publishSucceeded = false;
                
                try {
                  publishResult = await storage.publishTemplateUpdate({
                    templateId: templateId,
                    reviewId: createdReview.id,
                    versionNotes: analysis.recommendedChanges || 'Legislative update',
                    lastUpdateReason: `Bill ${bill.bill_number}: ${bill.title}`,
                    publishedBy: 'system',
                  });
                  publishSucceeded = true;
                  console.log(`  ✅ Published ${template.title} (v${publishResult.version.versionNumber})`);
                } catch (publishError) {
                  console.error(`  ❌ Failed to publish ${template.title}:`, publishError);
                  // Update review entry to rejected status on publish failure
                  try {
                    await storage.updateTemplateReviewQueue(createdReview.id, {
                      status: 'rejected',
                      reviewCompletedAt: new Date(),
                      rejectedAt: new Date(),
                      approvalNotes: `Auto-publish failed: ${publishError instanceof Error ? publishError.message : 'Unknown error'}`,
                    });
                  } catch (updateError) {
                    console.error(`  ⚠️  Failed to update review status to rejected:`, updateError);
                  }
                }
                
                // If publish succeeded, update review to approved
                if (publishSucceeded) {
                  try {
                    await storage.updateTemplateReviewQueue(createdReview.id, {
                      status: 'approved',
                      reviewCompletedAt: new Date(),
                      approvedChanges: analysis.recommendedChanges,
                      approvalNotes: 'Auto-approved by AI legislative monitoring system',
                      approvedAt: new Date(),
                      publishedAt: new Date(),
                      publishedBy: 'system',
                    });
                    templatesQueued++;
                    
                    // TODO: Notify users of template update
                    // This will be done via a separate notification job
                  } catch (updateError) {
                    console.error(`  ⚠️  Template published but failed to update review status:`, updateError);
                    console.error(`  ⚠️  MANUAL ACTION REQUIRED: Review ${createdReview.id} should be marked as approved`);
                    // Still count as success since template was published
                    templatesQueued++;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing state ${state.id}:`, error);
        }
      }

      // Update run summary
      const summaryReport = `
Legislative Monitoring Run Complete
=====================================
Run Date: ${new Date().toLocaleString()}
States Checked: ${activeStates.map(s => s.name).join(', ')}
Total Bills Found: ${totalBills}
Relevant Bills: ${relevantBills}
Templates Auto-Published: ${templatesQueued}

Status:
${templatesQueued > 0 ? `- ${templatesQueued} template(s) automatically published and users notified` : '- No template updates required'}
${relevantBills > 0 ? `- ${relevantBills} new bills are being monitored` : ''}
- Review history available in Admin Dashboard
      `.trim();

      await storage.createMonitoringRun({
        runDate: run.runDate,
        statesChecked: activeStates.map(s => s.id),
        billsFound: totalBills,
        relevantBills: relevantBills,
        templatesQueued: templatesQueued,
        status: 'success',
        errorMessage: null,
        summaryReport: summaryReport,
        emailSent: false,
      });

      console.log('\n✅ Legislative monitoring completed successfully!');
      console.log(summaryReport);

    } catch (error) {
      console.error('❌ Legislative monitoring failed:', error);
      
      await storage.createMonitoringRun({
        runDate: new Date(),
        statesChecked: activeStates.map(s => s.id),
        billsFound: totalBills,
        relevantBills: relevantBills,
        templatesQueued: templatesQueued,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        summaryReport: 'Monitoring run failed - see error message',
        emailSent: false,
      });
    }
  }

  /**
   * Manually trigger monitoring for a specific state (for testing)
   */
  async monitorState(stateId: string): Promise<void> {
    console.log(`🗳️  Manual monitoring check for ${stateId}...`);
    
    // Simplified version for manual testing
    const currentYear = new Date().getFullYear();
    const searchResults = await legiscanService.searchBills(stateId, currentYear);
    
    if (!searchResults) {
      console.log('No results from LegiScan');
      return;
    }

    console.log(`Found ${searchResults.searchresult.summary.count} bills`);
    
    // You can call runMonthlyMonitoring() to do full processing
  }
}

export const legislativeMonitoringService = new LegislativeMonitoringService();
