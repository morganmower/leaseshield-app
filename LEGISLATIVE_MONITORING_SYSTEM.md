# LeaseShield App - Automated Legislative Monitoring System

## Overview

LeaseShield App now includes a fully automated legislative monitoring system that tracks landlord-tenant legislation across all 4 supported states (UT, TX, ND, SD). Every month on the 1st, the system automatically:

1. **Queries LegiScan API** for new bills related to landlord-tenant law
2. **Analyzes relevance** using GPT-4 to determine which bills might affect templates
3. **Flags templates** that need attorney review
4. **Sends email report** to admin with findings
5. **Tracks everything** in the database for transparency

## How It Works

### Monthly Automated Workflow

**On the 1st of each month:**

```
1. System searches LegiScan for bills containing:
   - "landlord tenant"
   - "rental property"
   - "lease agreement"
   - "security deposit"
   - "eviction"
   - "residential tenancy"

2. For each bill found:
   - AI analyzes its relevance to landlord-tenant law
   - Determines which templates might be affected
   - Assigns relevance level (high/medium/low)
   - Saves to legislative_monitoring table

3. For affected templates:
   - Adds to template_review_queue
   - Sets priority based on impact
   - Assigns recommended changes

4. Sends email summary to admin:
   - Total bills found
   - Relevant bills identified
   - Templates queued for review
   - Detailed analysis for each bill
```

### Database Schema

**legislative_monitoring** - Tracks all bills from LegiScan
```typescript
{
  billId: string;           // LegiScan bill ID
  stateId: string;          // UT, TX, ND, SD
  billNumber: string;       // e.g., "SB 142"
  title: string;
  description: string;
  status: 'introduced' | 'in_committee' | 'passed_chamber' | 'signed' | 'vetoed' | 'dead';
  url: string;              // Link to bill on LegiScan
  lastAction: string;
  lastActionDate: Date;
  relevanceLevel: 'high' | 'medium' | 'low' | 'dismissed';
  aiAnalysis: string;       // GPT-4 explanation
  affectedTemplateIds: string[];  // Templates that might need updates
  isMonitored: boolean;
  isReviewed: boolean;
  reviewedBy: string;       // Admin who reviewed
  reviewNotes: string;
}
```

**template_review_queue** - Templates flagged for attorney review
```typescript
{
  templateId: string;
  billId: string;           // Reference to legislative_monitoring
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'published';
  priority: number;         // 1-10, higher = more urgent
  reason: string;           // Why this template needs review
  recommendedChanges: string;  // AI-suggested updates
  currentVersion: number;
  assignedTo: string;       // Attorney user ID
  attorneyNotes: string;
  approvedChanges: string;
}
```

**monitoring_runs** - Log of each automated run
```typescript
{
  runDate: Date;
  statesChecked: string[];  // ['UT', 'TX', 'ND', 'SD']
  billsFound: number;
  relevantBills: number;
  templatesQueued: number;
  status: 'success' | 'partial' | 'failed';
  errorMessage: string;
  summaryReport: string;    // Markdown summary for email
  emailSent: boolean;
}
```

## LegiScan API Integration

### Free Tier Limits
- **30,000 queries/month** (plenty for 4 states)
- Covers all 50 states + Congress
- Real-time legislative data
- Full bill text and metadata

### Service: `server/legiscan.ts`

**Main Methods:**
- `searchLandlordTenantBills(stateCode, year)` - Searches for relevant bills
- `analyzeBillRelevance(bill, templates)` - AI analysis of impact
- `getBillDetails(billId)` - Fetch complete bill data

**AI Analysis:**
Uses GPT-4 to analyze each bill and determine:
- Relevance level (high/medium/low/dismissed)
- Which templates are affected
- Recommended changes

### Example Query Flow

```typescript
// Search for bills in Utah
const bills = await legiScanService.searchLandlordTenantBills('UT', 2025);

// For each bill, analyze relevance
const analysis = await legiScanService.analyzeBillRelevance(bill, stateTemplates);

// Result:
{
  relevanceLevel: 'high',
  aiAnalysis: 'SB 142 changes security deposit return timelines from 30 to 45 days...',
  affectedTemplateIds: ['template-123', 'template-456']
}
```

## Admin Workflow

### Monthly Email Report

Admins receive an email on the 1st of each month with:

**Summary:**
- Total bills found across all states
- Number of relevant bills
- Number of templates queued for review

**Detailed Report:**
```markdown
## UT - Utah
Found 12 potential bills

### SB 142: Security Deposit Return Timeline
**Relevance:** HIGH
**Analysis:** This bill extends the security deposit return deadline from 30 to 45 days...
  → Queued template: Utah Security Deposit Return Form

### HB 203: Lease Termination Notice Requirements  
**Relevance:** MEDIUM
**Analysis:** Changes notice requirements for month-to-month tenancies...
  → Queued template: Utah Month-to-Month Termination Notice
```

### Reviewing Flagged Templates

**Option A: Manual Admin API (Future)**
```
GET /api/admin/template-review-queue
  → View all pending template reviews

PATCH /api/admin/template-review-queue/:id
  → Mark as reviewed, approve changes, publish
```

**Option B: Direct Database Access (Current)**
```sql
-- View pending reviews
SELECT * FROM template_review_queue WHERE status = 'pending' ORDER BY priority DESC;

-- Mark as reviewed
UPDATE template_review_queue 
SET status = 'approved', attorney_notes = 'Reviewed and approved'
WHERE id = '...';

-- Update template version
UPDATE templates 
SET version = version + 1, updated_at = NOW()
WHERE id = '...';
```

## Manual Testing

You can manually trigger the monthly monitoring:

```typescript
// In server console or API endpoint
import { runMonthlyLegislativeMonitoring } from './server/legislativeMonitoring';
await runMonthlyLegislativeMonitoring();
```

Or create an admin endpoint:

```typescript
// server/routes.ts
app.post('/api/admin/run-legislative-monitoring', isAuthenticated, async (req, res) => {
  await runMonthlyLegislativeMonitoring();
  res.json({ success: true });
});
```

## Configuration

### Environment Variables Required
- `LEGISCAN_API_KEY` - Free API key from legiscan.com
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI API base URL (already configured)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (already configured)
- `RESEND_API_KEY` - For sending admin email reports (already configured)

### Scheduling
- **Production**: Runs on the 1st of each month
- **Development**: Checks daily, runs only if it's the 1st and hasn't run this month
- **Manual**: Can be triggered via API endpoint (to be created)

## AI Analysis Prompt

The system uses this prompt to analyze bill relevance:

```
You are a legal analyst specializing in landlord-tenant law. Analyze this proposed legislation and determine:

1. Is this bill relevant to landlord-tenant relationships and rental property management?
2. If relevant, which specific templates would need to be updated?
3. What is the impact level?

BILL INFORMATION:
Title: [Bill Title]
Number: [Bill Number]
State: [State Code]
Description: [Bill Description]
Last Action: [Last Action]

AVAILABLE TEMPLATES:
- Utah Residential Lease Agreement (lease)
- Utah Security Deposit Return Form (security_deposit_return)
- ...

ANALYSIS INSTRUCTIONS:
- HIGH relevance: Directly changes lease requirements, security deposits, eviction procedures, tenant rights, or landlord obligations
- MEDIUM relevance: Affects compliance requirements, reporting, or procedural changes that might indirectly impact templates
- LOW relevance: Tangentially related to housing but unlikely to require template changes
- DISMISSED: Not related to landlord-tenant law

Respond in JSON format:
{
  "relevanceLevel": "high|medium|low|dismissed",
  "reasoning": "Brief explanation of why this matters (or doesn't)",
  "affectedTemplates": ["template-id-1", "template-id-2"],
  "recommendedChanges": "What specific changes might be needed"
}
```

## Cost Estimate

**LegiScan API:**
- Free tier: 30,000 queries/month
- Usage: ~24 queries/month (6 search terms × 4 states)
- Cost: $0/month

**OpenAI API:**
- Model: GPT-4
- Usage: ~50 bills/month × $0.03/bill = $1.50/month
- Cost: ~$2-5/month depending on bills found

**Total Monthly Cost: ~$2-5**

## Future Enhancements

### Phase 2: Admin Dashboard (Recommended Next)
- Web UI to review queued templates
- One-click approve and publish
- Template diff viewer
- Attorney assignment workflow

### Phase 3: Advanced Features
- Webhook integration for real-time alerts
- SMS notifications for high-impact bills (Twilio)
- Template versioning with changelog
- Automated template generation suggestions
- Multi-attorney review workflow

### Phase 4: Automation
- Auto-generate template updates (with attorney approval)
- Predictive analytics on legislative trends
- Integration with document assembly tools
- Automated regression testing of templates

## Troubleshooting

### No bills found?
- Check LegiScan API key is valid
- Verify the state codes (UT, TX, ND, SD)
- Check search terms are appropriate
- Try different year parameter

### AI analysis not working?
- Verify OpenAI API key is configured
- Check `AI_INTEGRATIONS_OPENAI_BASE_URL` is set
- Review console logs for errors
- Ensure sufficient OpenAI credits

### Email not sending?
- Verify Resend API key
- Check `support@leaseshieldapp.com` is the configured sender
- Review monitoring_runs table for email_sent status
- Check server logs for email errors

### Cron not running?
- Check server logs for "Legislative monitoring already ran this month"
- Verify system date/time is correct
- Test manually via API endpoint
- Check scheduled jobs are started on server boot

## Best Practices

1. **Review monthly reports promptly** - High-impact bills need fast action
2. **Maintain template versions** - Track all changes in version history
3. **Document all updates** - Keep notes on why templates changed
4. **Test before publishing** - Always review AI recommendations with attorney
5. **Archive old versions** - Keep historical templates for records
6. **Monitor API usage** - Stay within LegiScan free tier limits
7. **Track costs** - Monitor OpenAI usage for budget planning

## Support

For issues with the legislative monitoring system:
- **Technical**: Check server logs and database tables
- **Legislative**: Consult with attorney for legal interpretation
- **API**: Contact LegiScan support at legiscan.com
- **AI**: Review OpenAI API status and usage

---

**Last Updated:** November 19, 2024
**System Version:** 1.0
**Status:** Production Ready
