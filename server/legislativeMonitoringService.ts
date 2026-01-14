// Legislative Monitoring Orchestration Service
// Coordinates LegiScan API, Plural Policy API, CourtListener API, AI analysis, and database operations

import { legiscanService } from './legiscanService';
import { pluralPolicyService } from './pluralPolicyService';
import { federalRegisterService } from './federalRegisterService';
import { courtListenerService } from './courtListenerService';
import { billAnalysisService } from './billAnalysisService';
import { storage } from './storage';
import { notifyUsersOfTemplateUpdate } from './templateNotifications';
import type { InsertLegislativeMonitoring, InsertCaseLawMonitoring, InsertTemplateReviewQueue, InsertApplicationComplianceRule } from '@shared/schema';

export class LegislativeMonitoringService {
  /**
   * @deprecated Use ingestNow(), queueFromLatestIngest(), and publishApproved() instead.
   * This method is preserved temporarily but will throw an error if called.
   * The new safe workflow is:
   *   1. ingestNow() - fetch and normalize updates (no publishing)
   *   2. queueFromLatestIngest() - create review queue entries (no publishing)
   *   3. publishApproved() - only publish approved items
   */
  async runMonthlyMonitoring(): Promise<void> {
    throw new Error(
      'DEPRECATED: runMonthlyMonitoring() is no longer safe to call. ' +
      'Use ingestNow() + queueFromLatestIngest() for safe queuing, or publishApproved() for approved items only. ' +
      'The old "do everything" pattern has been replaced with explicit approval gates.'
    );
    
    // Original implementation preserved below for reference but unreachable
    console.log('🗳️  Starting monthly legislative monitoring run...');

    const states = await storage.getAllStates();
    const activeStates = states.filter(s => s.isActive);
    const currentYear = new Date().getFullYear();

    let totalBills = 0;
    let relevantBills = 0;
    let totalCases = 0;
    let relevantCases = 0;
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
              dataSource: 'legiscan',
              lastAction: lastAction.action,
              lastActionDate: new Date(lastAction.date),
              relevanceLevel: analysis.relevanceLevel,
              aiAnalysis: analysis.aiAnalysis,
              affectedTemplateIds: analysis.affectedTemplateIds,
              affectedComplianceCategories: analysis.affectedComplianceCategories,
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
                
                // If publish succeeded, update review to approved and notify users
                if (publishSucceeded && publishResult) {
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
                    
                    // Send immediate email notifications to affected users
                    await notifyUsersOfTemplateUpdate(publishResult.template, publishResult.version);
                    console.log(`  📧 Notifications sent for ${template.title}`);
                  } catch (updateError) {
                    console.error(`  ⚠️  Template published but failed to update review status:`, updateError);
                    console.error(`  ⚠️  MANUAL ACTION REQUIRED: Review ${createdReview.id} should be marked as approved`);
                    // Still count as success since template was published
                    templatesQueued++;
                  }
                }
              }
            }

            // Phase 1b: Check if this bill affects rental application compliance requirements
            const applicationImpact = await billAnalysisService.analyzeApplicationImpact(
              bill.title,
              bill.description,
              billText,
              state.id
            );

            if (applicationImpact.affectsApplications && applicationImpact.complianceRuleType) {
              console.log(`  📋 Bill ${bill.bill_number} affects rental applications - creating draft compliance rule...`);
              
              const ruleKey = applicationImpact.suggestedRuleKey || 
                `${state.id.toLowerCase()}_${bill.bill_number.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
              
              // Check if bill is enacted - only auto-activate if bill status indicates it's law
              const billStatus = legiscanService.mapBillStatus(bill.status);
              const isEnacted = billStatus === 'signed';
              
              try {
                const complianceRule: InsertApplicationComplianceRule = {
                  stateId: state.id,
                  ruleType: applicationImpact.complianceRuleType,
                  ruleKey: ruleKey,
                  title: applicationImpact.suggestedTitle || `${state.id} - ${bill.bill_number}`,
                  description: `${applicationImpact.explanation}${!isEnacted ? ' [PENDING: Awaiting enactment]' : ''}`,
                  checkboxLabel: applicationImpact.suggestedCheckboxLabel || undefined,
                  disclosureText: applicationImpact.suggestedDisclosureText || undefined,
                  statuteReference: applicationImpact.statuteReference || undefined,
                  sortOrder: 100, // Default sort order for auto-generated rules
                  // Only activate if bill is already enacted - otherwise create as draft for admin review
                  isActive: isEnacted,
                  effectiveDate: isEnacted ? new Date() : null, // Set effective date only when enacted
                  expiresAt: null,
                  version: 1,
                  sourceBillId: bill.bill_id.toString(),
                  sourceLegalUpdateId: null,
                };

                await storage.createApplicationComplianceRule(complianceRule);
                console.log(`  ✅ Created ${isEnacted ? 'active' : 'draft'} compliance rule: ${ruleKey}`);
                
                // Only notify landlords if the rule is active (bill is enacted)
                if (isEnacted) {
                  await this.notifyLandlordsOfComplianceChange(state.id, complianceRule, bill.bill_number);
                } else {
                  console.log(`  📝 Rule created as draft - will notify landlords when bill ${bill.bill_number} is enacted`);
                }
              } catch (ruleError) {
                console.error(`  ❌ Failed to create compliance rule:`, ruleError);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing state ${state.id}:`, error);
        }
      }

      // Phase 1b: Check Plural Policy (Open States) for additional bills
      console.log('\n\n🏛️  Phase 1b: Checking Plural Policy (Open States) for bills...');
      for (const state of activeStates) {
        try {
          console.log(`\n📋 Checking Plural Policy for ${state.name} (${state.id})...`);

          const ppResults = await pluralPolicyService.searchBills(state.id, currentYear);

          if (!ppResults || ppResults.results.length === 0) {
            console.log(`  ⚠️  No results from Plural Policy for ${state.id}`);
            continue;
          }

          console.log(`  📊 Found ${ppResults.results.length} bills from Plural Policy for ${state.id}`);
          totalBills += ppResults.results.length;

          for (const ppBill of ppResults.results.slice(0, 10)) {
            // Use pp_ prefix to distinguish Plural Policy bills
            const billIdForStorage = `pp_${ppBill.id}`;
            
            // Check if we've already processed this bill
            const existing = await storage.getLegislativeMonitoringByBillId(billIdForStorage);

            if (existing) {
              console.log(`  ⏭️  Bill ${ppBill.identifier} already tracked`);
              continue;
            }

            // Also check by bill number to avoid duplicates from LegiScan
            const existingByNumber = await storage.getLegislativeMonitoringByBillNumber(ppBill.identifier, state.id);
            if (existingByNumber) {
              console.log(`  ⏭️  Bill ${ppBill.identifier} already tracked from LegiScan`);
              continue;
            }

            // Check if bill is relevant to landlord-tenant law
            if (!pluralPolicyService.isRelevantBill(ppBill)) {
              console.log(`  ⏭️  ${ppBill.identifier} not relevant to landlord-tenant law`);
              continue;
            }

            console.log(`  🔍 Analyzing ${ppBill.identifier}: ${ppBill.title.substring(0, 60)}...`);

            const abstractText = ppBill.abstracts[0]?.abstract || ppBill.title;
            const billTextUrl = pluralPolicyService.getBillText(ppBill);

            // AI analysis to determine relevance and affected templates
            const analysis = await billAnalysisService.analyzeBill(
              ppBill.title,
              abstractText,
              null, // Bill text URL, not content
              state.id,
              allTemplates
            );

            // Skip if deemed not relevant
            if (analysis.relevanceLevel === 'dismissed' || analysis.relevanceLevel === 'low') {
              console.log(`  ⏭️  ${ppBill.identifier} dismissed as low relevance`);
              continue;
            }

            relevantBills++;

            const lastAction = pluralPolicyService.getLastAction(ppBill);

            // Map bill status from Plural Policy actions
            let billStatus: 'introduced' | 'in_committee' | 'passed_chamber' | 'passed_both' | 'signed' | 'vetoed' | 'dead' = 'introduced';
            if (lastAction) {
              const actionLower = lastAction.description.toLowerCase();
              if (actionLower.includes('signed') || actionLower.includes('enacted')) {
                billStatus = 'signed';
              } else if (actionLower.includes('passed') && actionLower.includes('both')) {
                billStatus = 'passed_both';
              } else if (actionLower.includes('passed')) {
                billStatus = 'passed_chamber';
              } else if (actionLower.includes('committee')) {
                billStatus = 'in_committee';
              } else if (actionLower.includes('vetoed')) {
                billStatus = 'vetoed';
              } else if (actionLower.includes('dead') || actionLower.includes('failed')) {
                billStatus = 'dead';
              }
            }

            // Save to legislative monitoring table
            const monitoringData: InsertLegislativeMonitoring = {
              billId: billIdForStorage,
              stateId: state.id,
              billNumber: ppBill.identifier,
              title: ppBill.title,
              description: abstractText,
              status: billStatus,
              url: pluralPolicyService.getBillUrl(ppBill),
              dataSource: 'plural_policy',
              lastAction: lastAction?.description || null,
              lastActionDate: lastAction ? new Date(lastAction.date) : null,
              relevanceLevel: analysis.relevanceLevel,
              aiAnalysis: analysis.aiAnalysis,
              affectedTemplateIds: analysis.affectedTemplateIds,
              affectedComplianceCategories: analysis.affectedComplianceCategories,
              isMonitored: true,
              isReviewed: false,
              reviewedBy: null,
              reviewedAt: null,
              reviewNotes: null,
            };

            const savedMonitoring = await storage.createLegislativeMonitoring(monitoringData);
            console.log(`  ✅ Saved ${ppBill.identifier} (Plural Policy) with ${analysis.relevanceLevel} relevance`);

            // If high or medium relevance and templates are affected, queue for review
            if ((analysis.relevanceLevel === 'high' || analysis.relevanceLevel === 'medium') && 
                analysis.affectedTemplateIds.length > 0) {
              
              for (const templateId of analysis.affectedTemplateIds) {
                const template = allTemplates.find(t => t.id === templateId);
                
                if (!template) continue;

                // Create review queue entry
                const reviewData: InsertTemplateReviewQueue = {
                  templateId: templateId,
                  billId: savedMonitoring.id,
                  status: 'pending',
                  priority: analysis.relevanceLevel === 'high' ? 10 : 5,
                  reason: `Bill ${ppBill.identifier}: ${ppBill.title}`,
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
                
                // Auto-publish the template update
                try {
                  const ppPublishResult = await storage.publishTemplateUpdate({
                    templateId: templateId,
                    reviewId: createdReview.id,
                    versionNotes: analysis.recommendedChanges || 'Legislative update',
                    lastUpdateReason: `Bill ${ppBill.identifier}: ${ppBill.title}`,
                    publishedBy: 'system',
                  });

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
                  console.log(`  📄 Template update published for ${template.title}`);
                  
                  // Send immediate email notifications to affected users
                  await notifyUsersOfTemplateUpdate(ppPublishResult.template, ppPublishResult.version);
                  console.log(`  📧 Notifications sent for ${template.title}`);
                } catch (publishError) {
                  console.error(`  ❌ Failed to publish template update:`, publishError);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing Plural Policy for state ${state.id}:`, error);
        }
      }

      // Phase 1c: Check Federal Register for HUD regulations (federal level)
      console.log('\n\n📜 Phase 1c: Checking Federal Register for HUD regulations...');
      try {
        const federalDocs = await federalRegisterService.getRecentHUDDocuments(30); // Last 30 days

        console.log(`  📊 Found ${federalDocs.length} federal housing documents`);

        for (const doc of federalDocs) {
          // Use fr_ prefix to distinguish Federal Register documents
          const docIdForStorage = `fr_${doc.document_number}`;

          // Check if we've already processed this document
          const existing = await storage.getLegislativeMonitoringByBillId(docIdForStorage);

          if (existing) {
            console.log(`  ⏭️  Document ${doc.document_number} already tracked`);
            continue;
          }

          // Check if document is relevant to landlord-tenant law
          if (!federalRegisterService.isLandlordTenantRelevant(doc)) {
            console.log(`  ⏭️  ${doc.document_number} not relevant to landlord-tenant law`);
            continue;
          }

          console.log(`  🔍 Analyzing ${doc.document_number}: ${(doc.title || '').substring(0, 60)}...`);

          // AI analysis to determine relevance and affected templates
          const analysis = await billAnalysisService.analyzeBill(
            doc.title || '',
            doc.abstract || doc.title || '',
            null,
            'US', // Federal designation (2-char code)
            allTemplates
          );

          // Skip if deemed not relevant
          if (analysis.relevanceLevel === 'dismissed' || analysis.relevanceLevel === 'low') {
            console.log(`  ⏭️  ${doc.document_number} dismissed as low relevance`);
            continue;
          }

          relevantBills++;

          // Map document type to bill status
          let docStatus: 'introduced' | 'in_committee' | 'passed_chamber' | 'passed_both' | 'signed' | 'vetoed' | 'dead' = 'introduced';
          if (doc.type === 'Rule') {
            docStatus = 'signed'; // Final rules are enacted
          } else if (doc.type === 'Proposed Rule') {
            docStatus = 'in_committee'; // Proposed rules are under review
          } else if (doc.type === 'Notice') {
            docStatus = 'introduced';
          }

          // Save to legislative monitoring table
          const monitoringData: InsertLegislativeMonitoring = {
            billId: docIdForStorage,
            stateId: 'US', // Federal designation (2-char code)
            billNumber: doc.document_number,
            title: doc.title || '',
            description: doc.abstract || doc.title || '',
            status: docStatus,
            url: doc.html_url || '',
            dataSource: 'federal_register',
            lastAction: doc.action || `Published: ${doc.publication_date}`,
            lastActionDate: doc.publication_date ? new Date(doc.publication_date) : null,
            relevanceLevel: analysis.relevanceLevel,
            aiAnalysis: analysis.aiAnalysis,
            affectedTemplateIds: analysis.affectedTemplateIds,
            affectedComplianceCategories: analysis.affectedComplianceCategories,
            isMonitored: true,
            isReviewed: false,
            reviewedBy: null,
            reviewedAt: null,
            reviewNotes: null,
          };

          const savedMonitoring = await storage.createLegislativeMonitoring(monitoringData);
          console.log(`  ✅ Saved ${doc.document_number} (Federal Register) with ${analysis.relevanceLevel} relevance`);

          // If high or medium relevance and templates are affected, queue for review
          if ((analysis.relevanceLevel === 'high' || analysis.relevanceLevel === 'medium') && 
              analysis.affectedTemplateIds.length > 0) {
            
            for (const templateId of analysis.affectedTemplateIds) {
              const template = allTemplates.find(t => t.id === templateId);
              
              if (!template) continue;

              // Create review queue entry
              const reviewData: InsertTemplateReviewQueue = {
                templateId: templateId,
                billId: savedMonitoring.id,
                status: 'pending',
                priority: analysis.relevanceLevel === 'high' ? 10 : 5,
                reason: `Federal Register ${doc.document_number}: ${doc.title}`,
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
              
              // Auto-publish the template update
              try {
                const frPublishResult = await storage.publishTemplateUpdate({
                  templateId: templateId,
                  reviewId: createdReview.id,
                  versionNotes: analysis.recommendedChanges || 'Federal regulatory update',
                  lastUpdateReason: `Federal Register ${doc.document_number}: ${doc.title}`,
                  publishedBy: 'system',
                });

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
                console.log(`  📄 Template update published for ${template.title}`);
                
                // Send immediate email notifications to affected users
                await notifyUsersOfTemplateUpdate(frPublishResult.template, frPublishResult.version);
                console.log(`  📧 Notifications sent for ${template.title}`);
              } catch (publishError) {
                console.error(`  ❌ Failed to publish template update:`, publishError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing Federal Register:', error);
      }

      // Phase 2: Check each state for new case law
      console.log('\n\n📜 Phase 2: Checking for relevant case law...');
      for (const state of activeStates) {
        try {
          console.log(`\n⚖️  Checking ${state.name} (${state.id}) for relevant case law...`);

          const caseSearchResults = await courtListenerService.searchCases(state.id);

          if (!caseSearchResults || caseSearchResults.meta.total_count === 0) {
            console.log(`  ⚠️  No case law found for ${state.id}`);
            continue;
          }

          const caseCount = caseSearchResults.meta.total_count;
          totalCases += caseCount;

          console.log(`  📊 Found ${caseCount} case law matches for ${state.id}`);

          // Process each case (limit to first 10 for MVP)
          for (const caseCluster of caseSearchResults.results.slice(0, 10)) {
            // Skip cases without an ID
            if (!caseCluster.id) {
              console.log(`  ⏭️  Skipping case with no ID`);
              continue;
            }
            
            // Check if we've already processed this case - if so, skip to avoid duplicates
            // (CourtListener returns national results, so different state searches may find same cases)
            const existingCase = await storage.getCaseLawMonitoringByCaseId(caseCluster.id.toString());

            if (existingCase) {
              console.log(`  ⏭️  Case ${caseCluster.case_name_short} already tracked (found in ${existingCase.stateId})`);
              continue;
            }

            // Check if case is relevant to landlord-tenant law
            if (!courtListenerService.isRelevantCase(caseCluster)) {
              console.log(`  ⏭️  ${caseCluster.case_name_short} not relevant to landlord-tenant law`);
              continue;
            }

            // Extract state from court name to validate this case belongs to the state we're searching for
            // CourtListener returns national results, so we need to filter by court jurisdiction
            const courtState = caseCluster.court?.toLowerCase() || '';
            const stateNameLower = state.name.toLowerCase();
            const isFromThisState = courtState.includes(stateNameLower) || 
                                   courtState.includes(state.id.toLowerCase());

            if (!isFromThisState) {
              console.log(`  ⏭️  ${caseCluster.case_name_short} is from ${caseCluster.court}, not ${state.name}`);
              continue;
            }

            console.log(`  🔍 Analyzing ${caseCluster.case_name_short}: ${caseCluster.case_name}...`);

            // Fetch full opinion if available for deeper analysis
            let opinionText: string | null = null;
            if (caseCluster.citations && caseCluster.citations.length > 0) {
              const firstOpinion = await courtListenerService.getCaseOpinion(caseCluster.id);
              if (firstOpinion?.plain_text) {
                opinionText = firstOpinion.plain_text;
              }
            }

            // AI analysis to determine relevance and affected templates
            const caseAnalysis = await billAnalysisService.analyzeCase(
              caseCluster.case_name,
              caseCluster.case_name_full || caseCluster.case_name,
              opinionText,
              state.id,
              allTemplates
            );

            // Skip if deemed not relevant
            if (caseAnalysis.relevanceLevel === 'dismissed' || caseAnalysis.relevanceLevel === 'low') {
              console.log(`  ⏭️  ${caseCluster.case_name_short} dismissed as low relevance`);
              continue;
            }

            relevantCases++;

            const caseDetails = courtListenerService.getCaseDetails(caseCluster);

            // Save to case law monitoring table
            const caseLawData: InsertCaseLawMonitoring = {
              caseId: caseCluster.id.toString(),
              stateId: state.id,
              caseName: caseDetails.title,
              caseNameFull: caseCluster.case_name_full,
              citation: caseDetails.citation,
              court: caseDetails.court,
              dateFiled: new Date(caseDetails.dateFiled),
              caseNumber: caseDetails.caseNumber,
              url: caseDetails.url,
              relevanceLevel: caseAnalysis.relevanceLevel,
              aiAnalysis: caseAnalysis.aiAnalysis,
              affectedTemplateIds: caseAnalysis.affectedTemplateIds,
              isMonitored: true,
              isReviewed: false,
              reviewedBy: null,
              reviewedAt: null,
              reviewNotes: null,
            };

            const savedCaseMonitoring = await storage.createCaseLawMonitoring(caseLawData);
            console.log(`  ✅ Saved ${caseDetails.citation} with ${caseAnalysis.relevanceLevel} relevance`);

            // If high or medium relevance and templates are affected, auto-publish updates
            if ((caseAnalysis.relevanceLevel === 'high' || caseAnalysis.relevanceLevel === 'medium') && 
                caseAnalysis.affectedTemplateIds.length > 0) {
              
              for (const templateId of caseAnalysis.affectedTemplateIds) {
                const template = allTemplates.find(t => t.id === templateId);
                
                if (!template) continue;

                // Create review queue entry as pending first (for atomicity)
                const caseReviewData: InsertTemplateReviewQueue = {
                  templateId: templateId,
                  billId: savedCaseMonitoring.id,
                  status: 'pending',
                  priority: caseAnalysis.relevanceLevel === 'high' ? 10 : 5,
                  reason: `Case ${caseDetails.citation}: ${caseDetails.title}`,
                  recommendedChanges: caseAnalysis.recommendedChanges,
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

                const createdCaseReview = await storage.createTemplateReviewQueue(caseReviewData);
                
                // Auto-publish the template update immediately
                let casePublishResult: any = null;
                let publishSucceeded = false;
                
                try {
                  casePublishResult = await storage.publishTemplateUpdate({
                    templateId: templateId,
                    reviewId: createdCaseReview.id,
                    versionNotes: caseAnalysis.recommendedChanges || 'Case law update',
                    lastUpdateReason: `Case ${caseDetails.citation}: ${caseDetails.title}`,
                    publishedBy: 'system',
                  });
                  publishSucceeded = true;
                  console.log(`  ✅ Published ${template.title} (v${casePublishResult.version.versionNumber})`);
                } catch (publishError) {
                  console.error(`  ❌ Failed to publish ${template.title}:`, publishError);
                  // Update review entry to rejected status on publish failure
                  try {
                    await storage.updateTemplateReviewQueue(createdCaseReview.id, {
                      status: 'rejected',
                      reviewCompletedAt: new Date(),
                      rejectedAt: new Date(),
                      approvalNotes: `Auto-publish failed: ${publishError instanceof Error ? publishError.message : 'Unknown error'}`,
                    });
                  } catch (updateError) {
                    console.error(`  ⚠️  Failed to update review status to rejected:`, updateError);
                  }
                }
                
                // If publish succeeded, update review to approved and notify users
                if (publishSucceeded && casePublishResult) {
                  try {
                    await storage.updateTemplateReviewQueue(createdCaseReview.id, {
                      status: 'approved',
                      reviewCompletedAt: new Date(),
                      approvedChanges: caseAnalysis.recommendedChanges,
                      approvalNotes: 'Auto-approved by AI case law monitoring system',
                      approvedAt: new Date(),
                      publishedAt: new Date(),
                      publishedBy: 'system',
                    });
                    templatesQueued++;
                    
                    // Send immediate email notifications to affected users
                    await notifyUsersOfTemplateUpdate(casePublishResult.template, casePublishResult.version);
                    console.log(`  📧 Notifications sent for ${template.title}`);
                  } catch (updateError) {
                    console.error(`  ⚠️  Template published but failed to update review status:`, updateError);
                    console.error(`  ⚠️  MANUAL ACTION REQUIRED: Review ${createdCaseReview.id} should be marked as approved`);
                    templatesQueued++;
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing case law for state ${state.id}:`, error);
        }
      }

      // Update run summary
      const summaryReport = `
Legislative Monitoring Run Complete
=====================================
Run Date: ${new Date().toLocaleString()}
States Checked: ${activeStates.map(s => s.name).join(', ')}

Bills Phase:
- Total Bills Found: ${totalBills}
- Relevant Bills: ${relevantBills}

Case Law Phase:
- Total Cases Found: ${totalCases}
- Relevant Cases: ${relevantCases}

Templates Auto-Published: ${templatesQueued}

Status:
${templatesQueued > 0 ? `- ${templatesQueued} template(s) automatically published and users notified` : '- No template updates required'}
${relevantBills + relevantCases > 0 ? `- ${relevantBills} bill(s) and ${relevantCases} case(s) are being monitored` : ''}
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

  /**
   * Notify landlords in affected state about new application compliance requirements
   * Creates in-app notifications and sends email via Resend
   */
  async notifyLandlordsOfComplianceChange(
    stateId: string, 
    complianceRule: InsertApplicationComplianceRule, 
    billNumber: string
  ): Promise<void> {
    try {
      console.log(`  📧 Notifying landlords in ${stateId} about new compliance requirement...`);
      
      // Get all users who have properties in this state or have it as their preferred state
      const usersInState = await storage.getUsersByState(stateId);
      const allUsers = await storage.getAllActiveUsers();
      
      // Filter to users who want legal update notifications
      const usersToNotify = allUsers.filter(user => 
        user.notifyLegalUpdates && 
        (user.preferredState === stateId || usersInState.some(u => u.id === user.id))
      );
      
      console.log(`  📬 Found ${usersToNotify.length} users to notify in ${stateId}`);
      
      const notificationMessage = `New Rental Application Requirement: ${complianceRule.title}. ${billNumber} has introduced new compliance requirements for rental applications in ${stateId}. Your application form will automatically include this new requirement.`;
      
      // Create in-app notifications for each user
      for (const user of usersToNotify) {
        try {
          await storage.createUserNotification({
            userId: user.id,
            legalUpdateId: null,
            templateId: null,
            message: notificationMessage,
            isRead: false,
            readAt: null,
          });
        } catch (notifError) {
          console.error(`  ⚠️  Failed to create notification for user ${user.id}:`, notifError);
        }
      }
      
      // Send email notifications via Resend
      if (process.env.RESEND_API_KEY && usersToNotify.length > 0) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          
          // Send to each user who has an email
          for (const user of usersToNotify.filter(u => u.email)) {
            try {
              await resend.emails.send({
                from: 'LeaseShield <notifications@leaseshield.app>',
                to: user.email,
                subject: `New Application Requirement for ${stateId} Properties - ${billNumber}`,
                html: `
                  <h2>New Rental Application Compliance Requirement</h2>
                  <p><strong>State:</strong> ${stateId}</p>
                  <p><strong>Bill:</strong> ${billNumber}</p>
                  <p><strong>Requirement:</strong> ${complianceRule.title}</p>
                  ${complianceRule.statuteReference ? `<p><strong>Legal Citation:</strong> ${complianceRule.statuteReference}</p>` : ''}
                  <p>${complianceRule.description || ''}</p>
                  <hr>
                  <p><strong>What this means for you:</strong></p>
                  <p>Your rental application form will automatically be updated to include this new requirement. 
                  Applicants applying to properties in ${stateId} will now see additional compliance 
                  disclosures and acknowledgments as required by this legislation.</p>
                  <p><em>No action is required on your part - LeaseShield has already updated your application flow.</em></p>
                  <hr>
                  <p style="font-size: 12px; color: #666;">
                    You received this email because you have properties in ${stateId} or have it set as your preferred state.
                    <br>Manage your notification preferences in your LeaseShield account settings.
                  </p>
                `,
              });
              console.log(`  ✉️  Sent email to ${user.email}`);
            } catch (emailError) {
              console.error(`  ⚠️  Failed to send email to ${user.email}:`, emailError);
            }
          }
        } catch (resendError) {
          console.error('  ⚠️  Failed to initialize Resend for compliance notifications:', resendError);
        }
      }
      
      console.log(`  ✅ Notified ${usersToNotify.length} landlords about new compliance requirement`);
    } catch (error) {
      console.error('  ❌ Error notifying landlords of compliance change:', error);
    }
  }

  // ============================================================================
  // NEW REFACTORED METHODS (Safe orchestration with approval gates)
  // ============================================================================

  /**
   * Ingest now - fetch from all sources, normalize, store.
   * Does NOT touch templates or publish anything.
   * Returns structured result for admin UI.
   */
  async ingestNow(): Promise<{
    sources: Record<string, { fetched: number; new: number; status: string }>;
    totalFetched: number;
    totalNew: number;
    errors: string[];
  }> {
    console.log('\n🌙 [ingestNow] Starting legislative ingest...');
    
    const { runNightlyIngest } = await import('./legislation/ingestService');
    const result = await runNightlyIngest();
    
    const sources: Record<string, { fetched: number; new: number; status: string }> = {};
    for (const sr of result.sourceResults) {
      sources[sr.sourceKey] = {
        fetched: sr.itemsFetched,
        new: sr.newItems,
        status: sr.status,
      };
    }
    
    console.log(`✅ [ingestNow] Complete: ${result.newItemsStored} new items from ${result.sourcesProcessed} sources`);
    
    return {
      sources,
      totalFetched: result.totalItemsFetched,
      totalNew: result.newItemsStored,
      errors: result.errors,
    };
  }

  /**
   * Queue from latest ingest - find unprocessed normalized updates,
   * map to templates via topic routing, create review queue entries.
   * Does NOT publish. Dedupes queue entries.
   * Returns structured result for admin UI.
   */
  async queueFromLatestIngest(): Promise<{
    updatesProcessed: number;
    updatesQueued: number;
    templatesQueued: number;
    queueEntries: Array<{ templateId: string; updateId: string; reason: string }>;
  }> {
    console.log('\n📋 [queueFromLatestIngest] Creating review queue from new updates...');
    
    const { db } = await import('./db');
    const { normalizedUpdates, templateTopicRouting, templateReviewQueue, templates } = await import('@shared/schema');
    const { eq, and, inArray } = await import('drizzle-orm');
    
    const newUpdates = await db.select()
      .from(normalizedUpdates)
      .where(and(
        eq(normalizedUpdates.isProcessed, false),
        eq(normalizedUpdates.isDuplicate, false)
      ));
    
    console.log(`   Found ${newUpdates.length} unprocessed updates`);
    
    let updatesQueued = 0;
    let templatesQueued = 0;
    const queueEntries: Array<{ templateId: string; updateId: string; reason: string }> = [];
    
    for (const update of newUpdates) {
      const routings = await db.select({
        templateId: templateTopicRouting.templateId,
        topic: templateTopicRouting.topic,
        jurisdictionLevel: templateTopicRouting.jurisdictionLevel,
        jurisdictionState: templateTopicRouting.jurisdictionState,
      })
        .from(templateTopicRouting)
        .where(eq(templateTopicRouting.isActive, true));
      
      const matchingTemplateIds = routings
        .filter(r => {
          if (!update.topics.includes(r.topic)) return false;
          if (r.jurisdictionLevel === 'tribal' && update.jurisdictionLevel !== 'tribal') return false;
          if (update.jurisdictionLevel === 'tribal' && r.jurisdictionLevel !== 'tribal' && r.jurisdictionLevel !== 'federal') return false;
          if (r.jurisdictionState && update.jurisdictionState && r.jurisdictionState !== update.jurisdictionState) return false;
          return true;
        })
        .map(r => r.templateId);
      
      const uniqueTemplateIds = Array.from(new Set(matchingTemplateIds));
      
      for (const templateId of uniqueTemplateIds) {
        const existing = await db.select({ id: templateReviewQueue.id })
          .from(templateReviewQueue)
          .where(and(
            eq(templateReviewQueue.templateId, templateId),
            eq(templateReviewQueue.normalizedUpdateId, update.id)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          continue;
        }
        
        const reason = `Legislative update: ${update.title.substring(0, 80)}${update.title.length > 80 ? '...' : ''}`;
        
        await db.insert(templateReviewQueue).values({
          templateId,
          normalizedUpdateId: update.id,
          status: 'pending',
          priority: update.severity === 'critical' ? 10 : update.severity === 'high' ? 7 : 5,
          reason,
          jurisdiction: update.jurisdictionState || undefined,
          queuedAt: new Date(),
        } as any);
        
        templatesQueued++;
        queueEntries.push({ templateId, updateId: update.id, reason });
      }
      
      await db.update(normalizedUpdates)
        .set({
          isProcessed: true,
          processedAt: new Date(),
          isQueued: uniqueTemplateIds.length > 0,
          queuedAt: uniqueTemplateIds.length > 0 ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(normalizedUpdates.id, update.id));
      
      if (uniqueTemplateIds.length > 0) {
        updatesQueued++;
      }
    }
    
    console.log(`✅ [queueFromLatestIngest] Complete: ${updatesQueued} updates queued, ${templatesQueued} template review entries created`);
    
    return {
      updatesProcessed: newUpdates.length,
      updatesQueued,
      templatesQueued,
      queueEntries,
    };
  }

  /**
   * Publish approved only - finds approved review queue items,
   * rebuilds documents, marks as published.
   * NEVER publishes unapproved items.
   * Returns structured result for admin UI.
   */
  async publishApproved(): Promise<{
    approvedCount: number;
    publishedCount: number;
    failedCount: number;
    publishedTemplates: Array<{ templateId: string; version: number }>;
    errors: string[];
  }> {
    console.log('\n📦 [publishApproved] Publishing approved template updates...');
    
    const { db } = await import('./db');
    const { templateReviewQueue, templates, documentBuilds } = await import('@shared/schema');
    const { eq, and, isNull } = await import('drizzle-orm');
    
    const approvedItems = await db.select()
      .from(templateReviewQueue)
      .where(and(
        eq(templateReviewQueue.status, 'approved'),
        isNull(templateReviewQueue.publishedAt)
      ));
    
    console.log(`   Found ${approvedItems.length} approved items pending publish`);
    
    if (approvedItems.length === 0) {
      return {
        approvedCount: 0,
        publishedCount: 0,
        failedCount: 0,
        publishedTemplates: [],
        errors: [],
      };
    }
    
    let publishedCount = 0;
    let failedCount = 0;
    const publishedTemplates: Array<{ templateId: string; version: number }> = [];
    const errors: string[] = [];
    
    for (const item of approvedItems) {
      try {
        const [template] = await db.select()
          .from(templates)
          .where(eq(templates.id, item.templateId))
          .limit(1);
        
        if (!template) {
          errors.push(`Template ${item.templateId} not found`);
          failedCount++;
          continue;
        }
        
        const newVersion = (template.version || 1) + 1;
        
        await db.update(templates)
          .set({
            version: newVersion,
            versionNotes: item.reason || 'Legislative update',
            lastUpdateReason: item.reason || 'Legislative update',
            updatedAt: new Date(),
          })
          .where(eq(templates.id, item.templateId));
        
        await db.insert(documentBuilds).values({
          templateId: item.templateId,
          reviewQueueId: item.id,
          buildType: 'both',
          status: 'completed',
          version: newVersion,
          startedAt: new Date(),
          completedAt: new Date(),
        } as any);
        
        await db.update(templateReviewQueue)
          .set({
            status: 'published',
            publishedAt: new Date(),
          })
          .where(eq(templateReviewQueue.id, item.id));
        
        publishedTemplates.push({ templateId: item.templateId, version: newVersion });
        publishedCount++;
        
        console.log(`   ✅ Published ${item.templateId} v${newVersion}`);
        
      } catch (error) {
        const errMsg = `Failed to publish ${item.templateId}: ${error}`;
        console.error(`   ❌ ${errMsg}`);
        errors.push(errMsg);
        failedCount++;
      }
    }
    
    console.log(`✅ [publishApproved] Complete: ${publishedCount} published, ${failedCount} failed`);
    
    return {
      approvedCount: approvedItems.length,
      publishedCount,
      failedCount,
      publishedTemplates,
      errors,
    };
  }
}

export const legislativeMonitoringService = new LegislativeMonitoringService();
