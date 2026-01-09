import { legiScanService } from './legiscan';
import { storage } from './storage';
import { getUncachableResendClient } from './resend';
import { getActiveStateIds } from './states/getActiveStates';

export async function runMonthlyLegislativeMonitoring(): Promise<void> {
  console.log('🔍 Starting monthly legislative monitoring...');
  
  const runId = crypto.randomUUID();
  let totalBillsFound = 0;
  let totalRelevantBills = 0;
  let totalTemplatesQueued = 0;
  const summaryParts: string[] = [];

  try {
    // Get all templates for AI analysis
    const allTemplates = await storage.getAllTemplates();
    
    // Get active states from database (cached for 5 minutes)
    const monitoredStates = await getActiveStateIds();

    for (const stateCode of monitoredStates) {
      console.log(`  Checking ${stateCode}...`);
      summaryParts.push(`\n## ${stateCode} - ${getStateName(stateCode)}`);

      // Search for landlord-tenant bills in this state
      const bills = await legiScanService.searchLandlordTenantBills(stateCode);
      totalBillsFound += bills.length;
      
      summaryParts.push(`Found ${bills.length} potential bills`);

      if (bills.length === 0) {
        summaryParts.push('No new legislation found');
        continue;
      }

      // Get state-specific templates for analysis
      const stateTemplates = allTemplates
        .filter(t => t.stateId === stateCode)
        .map(t => ({
          id: t.id,
          title: t.title,
          templateType: t.templateType,
        }));

      for (const bill of bills) {
        // Check if we've already monitored this bill
        const existing = await storage.getLegislativeMonitoringByBillId(bill.billId);
        if (existing) {
          console.log(`    Skipping ${bill.billNumber} (already monitored)`);
          continue;
        }

        // Analyze relevance using AI
        console.log(`    Analyzing ${bill.billNumber}...`);
        const analysis = await legiScanService.analyzeBillRelevance(bill, stateTemplates);

        // Only track bills that are at least low relevance
        if (analysis.relevanceLevel === 'dismissed') {
          console.log(`    Dismissed: ${bill.billNumber}`);
          continue;
        }

        totalRelevantBills++;

        // Save to monitoring table
        const monitoringEntry = await storage.createLegislativeMonitoring({
          billId: bill.billId,
          stateId: bill.stateId,
          billNumber: bill.billNumber,
          title: bill.title,
          description: bill.description,
          status: bill.status as any,
          url: bill.url,
          lastAction: bill.lastAction,
          lastActionDate: new Date(bill.lastActionDate),
          relevanceLevel: analysis.relevanceLevel,
          aiAnalysis: analysis.aiAnalysis,
          affectedTemplateIds: analysis.affectedTemplateIds,
          isMonitored: true,
          isReviewed: false,
        });

        summaryParts.push(`\n### ${bill.billNumber}: ${bill.title}`);
        summaryParts.push(`**Relevance:** ${analysis.relevanceLevel.toUpperCase()}`);
        summaryParts.push(`**Analysis:** ${analysis.aiAnalysis.substring(0, 200)}...`);

        // Queue affected templates for review
        if (analysis.affectedTemplateIds.length > 0) {
          for (const templateId of analysis.affectedTemplateIds) {
            const template = allTemplates.find(t => t.id === templateId);
            if (!template) continue;

            await storage.createTemplateReviewQueue({
              templateId: templateId,
              billId: monitoringEntry.id,
              status: 'pending',
              priority: analysis.relevanceLevel === 'high' ? 9 : analysis.relevanceLevel === 'medium' ? 6 : 3,
              reason: `${bill.billNumber} may affect this template`,
              recommendedChanges: analysis.aiAnalysis,
              currentVersion: template.version || 1,
            });

            totalTemplatesQueued++;
            summaryParts.push(`  → Queued template: ${template.title}`);
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Create monitoring run record
    const summaryReport = summaryParts.join('\n');
    await storage.createMonitoringRun({
      statesChecked: monitoredStates,
      billsFound: totalBillsFound,
      relevantBills: totalRelevantBills,
      templatesQueued: totalTemplatesQueued,
      status: 'success',
      summaryReport: summaryReport,
      emailSent: false,
    });

    // Send email summary to admin
    if (totalRelevantBills > 0) {
      await sendMonitoringSummaryEmail(summaryReport, totalBillsFound, totalRelevantBills, totalTemplatesQueued);
    }

    console.log('✅ Legislative monitoring complete');
    console.log(`   Found: ${totalBillsFound} bills`);
    console.log(`   Relevant: ${totalRelevantBills} bills`);
    console.log(`   Queued: ${totalTemplatesQueued} templates`);

  } catch (error) {
    console.error('❌ Legislative monitoring failed:', error);
    
    // Fallback to empty array if we couldn't fetch states
    const fallbackStates = await getActiveStateIds().catch(() => [] as string[]);
    await storage.createMonitoringRun({
      statesChecked: fallbackStates,
      billsFound: totalBillsFound,
      relevantBills: totalRelevantBills,
      templatesQueued: totalTemplatesQueued,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      summaryReport: summaryParts.join('\n'),
      emailSent: false,
    });
  }
}

async function sendMonitoringSummaryEmail(
  summary: string,
  totalBills: number,
  relevantBills: number,
  templatesQueued: number
): Promise<void> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Legislative Monitoring Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                LeaseShield App
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; font-size: 14px;">
                Monthly Legislative Monitoring Report
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 600;">
                Summary
              </h2>
              <div style="background-color: #f1f5f9; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px;">
                  <strong>Bills Found:</strong> ${totalBills}
                </p>
                <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px;">
                  <strong>Relevant Bills:</strong> ${relevantBills}
                </p>
                <p style="margin: 0; color: #475569; font-size: 14px;">
                  <strong>Templates Queued for Review:</strong> ${templatesQueued}
                </p>
              </div>

              <h3 style="margin: 24px 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 600;">
                Detailed Report
              </h3>
              <div style="white-space: pre-wrap; font-family: monospace; font-size: 13px; color: #475569; background-color: #f8fafc; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0;">
${summary}
              </div>

              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 13px;">
                  Next Steps: Review queued templates in your admin dashboard and consult with your attorney for any high-priority changes.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 13px;">
                This is an automated report from LeaseShield App
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
LeaseShield Monthly Legislative Monitoring Report

SUMMARY:
- Bills Found: ${totalBills}
- Relevant Bills: ${relevantBills}
- Templates Queued for Review: ${templatesQueued}

DETAILED REPORT:
${summary}

Next Steps: Review queued templates in your admin dashboard and consult with your attorney for any high-priority changes.
    `;

    await client.emails.send({
      from: fromEmail,
      to: 'support@leaseshieldapp.com', // Send to admin email
      subject: `Legislative Monitoring Report - ${relevantBills} Relevant Bills Found`,
      html: html,
      text: text,
    });

    console.log('✉️  Monitoring summary email sent');
  } catch (error) {
    console.error('Error sending monitoring summary email:', error);
  }
}

function getStateName(code: string): string {
  const names: Record<string, string> = {
    'UT': 'Utah',
    'TX': 'Texas',
    'ND': 'North Dakota',
    'SD': 'South Dakota',
  };
  return names[code] || code;
}
