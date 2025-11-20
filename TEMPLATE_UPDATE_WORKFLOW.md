# LeaseShield App - Template Update & Versioning Workflow

## Overview

This document describes the end-to-end workflow for updating templates based on legislative changes, versioning them, and notifying users.

## Complete Workflow

### Step 1: Automated Detection (Monthly - 1st of Month)
```
Legislative Monitoring System:
1. Queries LegiScan API for new landlord-tenant bills
2. AI analyzes each bill's relevance
3. Identifies affected templates
4. Adds to template_review_queue with status='pending'
5. Sends admin email with monthly report
```

### Step 2: Admin Review (Human-in-the-Loop)
```
Admin Dashboard (Future UI):
1. Admin logs in and reviews pending template updates
2. Views AI recommendations for each template
3. Consults with attorney if needed
4. Either:
   - APPROVES: Provides updated content + version notes
   - REJECTS: Marks as "no changes needed" with notes
```

### Step 3: Template Publishing (Automated)
```
When Admin Approves:
1. System increments template version (v1 → v2)
2. Updates template content (pdfUrl or fillableFormData)
3. Saves version notes ("Updated for SB 142")
4. Creates immutable record in template_versions table
5. Marks review_queue item as 'published'
6. Marks legislativeMonitoring as 'reviewed'
```

### Step 4: User Notification (Automated)
```
After Publishing:
1. Finds all users with that template's state
2. Sends email: "Important: Utah Lease Agreement Updated"
3. Creates in-app notification for each user
4. Email includes what changed and why
```

### Step 5: Frontend Display (User-Facing)
```
Templates Page:
1. Shows "Updated" badge for recently updated templates (last 30 days)
2. Displays version number (v2.0, v3.1, etc.)
3. Clicking template shows changelog modal
4. Users can download latest version

Dashboard/Notifications:
1. In-app notification count shows updates
2. Clicking notification opens template details
3. Mark as read functionality
```

## Database Schema

### template_versions (Version History)
```typescript
{
  id: uuid,
  templateId: uuid,
  versionNumber: number,          // 2, 3, 4...
  pdfUrl: string,
  fillableFormData: json,
  versionNotes: string,            // "Updated security deposit return deadline to 45 days"
  lastUpdateReason: string,        // "SB 142 - Security Deposit Timeline Changes"
  sourceReviewId: uuid,            // Links to templateReviewQueue
  metadata: json,
  createdBy: uuid,                 // Admin who published
  createdAt: timestamp
}
```

### templates (Current Version)
```typescript
{
  ...existing fields,
  version: number,                 // Current version number
  versionNotes: string,            // What changed in current version
  lastUpdateReason: string,        // Why it was updated
  updatedAt: timestamp             // When last updated
}
```

### template_review_queue (Review Workflow)
```typescript
{
  ...existing fields,
  approvalNotes: string,           // Admin notes on approval/rejection
  approvedAt: timestamp,
  rejectedAt: timestamp,
  updatedTemplateSnapshot: json,   // Stores the approved changes
  publishedAt: timestamp,
  publishedBy: uuid
}
```

## API Endpoints

### Admin Review Endpoints (To Be Implemented)

#### GET /api/admin/template-review-queue
List all pending template reviews with filters
```typescript
Query Params:
- status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'published'
- priority: number (1-10)
- stateId: string

Response:
{
  reviews: [
    {
      id: string,
      template: { id, title, category, stateId },
      bill: { billNumber, title, description },
      status: string,
      priority: number,
      reason: string,
      recommendedChanges: string,
      currentVersion: number,
      createdAt: timestamp
    }
  ],
  total: number
}
```

#### PATCH /api/admin/template-review-queue/:id/approve
Approve and publish template update
```typescript
Request Body:
{
  approvalNotes: string,
  versionNotes: string,            // What changed
  lastUpdateReason: string,        // Why it changed (e.g., "SB 142")
  pdfUrl?: string,                 // Updated file URL
  fillableFormData?: json          // Updated form data
}

Response:
{
  success: true,
  template: { id, title, version },  // Updated template
  versionRecord: { id, versionNumber }, // New version history entry
  notificationsSent: number           // Users notified
}
```

#### PATCH /api/admin/template-review-queue/:id/reject
Reject template update
```typescript
Request Body:
{
  approvalNotes: string  // Why rejected (e.g., "Bill did not pass")
}

Response:
{
  success: true,
  reviewId: string,
  status: 'rejected'
}
```

### Template Version Endpoints (To Be Implemented)

#### GET /api/templates/:id/versions
Get version history for a template
```typescript
Response:
{
  template: { id, title, currentVersion },
  versions: [
    {
      versionNumber: 3,
      versionNotes: "Updated for SB 142",
      lastUpdateReason: "SB 142 - Security Deposit Timeline Changes",
      createdAt: "2025-02-15",
      createdBy: "Admin Name"
    },
    {
      versionNumber: 2,
      versionNotes: "Fixed typo in section 4",
      lastUpdateReason: "Quality improvement",
      createdAt: "2024-11-10",
      createdBy: "Admin Name"
    }
  ]
}
```

## Storage Layer Methods

### Template Publishing
```typescript
interface IStorage {
  // Publish approved template update
  publishTemplateUpdate(data: {
    templateId: string,
    reviewId: string,
    pdfUrl?: string,
    fillableFormData?: any,
    versionNotes: string,
    lastUpdateReason: string,
    publishedBy: string
  }): Promise<{
    template: Template,
    version: TemplateVersion
  }>;

  // Get template version history
  getTemplateVersions(templateId: string): Promise<TemplateVersion[]>;

  // Check if template was recently updated (for UI badges)
  isTemplateRecentlyUpdated(templateId: string, daysThreshold: number): Promise<boolean>;
}
```

## Email Notification Template

### Subject
```
Important: [State] [Template Name] Updated - Version [X.0]
```

### Body
```html
<h2>Template Update Notification</h2>

<p>The following template has been updated to comply with recent legislative changes:</p>

<div class="template-info">
  <h3>[Template Name] (Version [X.0])</h3>
  <p><strong>State:</strong> [State Name]</p>
  <p><strong>Category:</strong> [Category]</p>
</div>

<div class="update-details">
  <h4>What Changed:</h4>
  <p>[Version Notes]</p>

  <h4>Why It Changed:</h4>
  <p>[Last Update Reason - e.g., "SB 142 changed security deposit return deadlines from 30 to 45 days"]</p>
</div>

<div class="action">
  <a href="[app-url]/templates/[template-id]" class="button">
    Download Updated Template
  </a>
</div>

<p class="disclaimer">
  <strong>Important:</strong> Please review the updated template carefully. 
  If you have active leases or documents using the previous version, 
  consult with an attorney about whether updates are needed.
</p>
```

## Frontend Implementation

### Templates Page Updates
```typescript
// Add to Template card component
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <h3>{template.title}</h3>
      <div className="flex gap-2">
        {isRecentlyUpdated(template.updatedAt) && (
          <Badge variant="destructive" data-testid={`badge-updated-${template.id}`}>
            Updated
          </Badge>
        )}
        <Badge variant="outline" data-testid={`badge-version-${template.id}`}>
          v{template.version}.0
        </Badge>
      </div>
    </div>
  </CardHeader>
  
  <CardContent>
    {template.lastUpdateReason && (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {template.lastUpdateReason}
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

### Changelog Modal
```typescript
<Dialog>
  <DialogTrigger>View Changelog</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Version History - {template.title}</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-4">
      {versions.map(version => (
        <div key={version.id} className="border-l-4 border-primary pl-4">
          <h4 className="font-semibold">Version {version.versionNumber}.0</h4>
          <p className="text-sm text-muted-foreground">
            {formatDate(version.createdAt)} • {version.createdBy}
          </p>
          <p className="mt-2">{version.versionNotes}</p>
          {version.lastUpdateReason && (
            <p className="mt-1 text-sm italic">{version.lastUpdateReason}</p>
          )}
        </div>
      ))}
    </div>
  </DialogContent>
</Dialog>
```

## Current Implementation Status

### ✅ Completed
- Database schema for version tracking (templates, templateVersions, templateReviewQueue)
- Monthly legislative monitoring with AI analysis
- Email reports to admin
- Template review queue population

### 🚧 In Progress
- Storage methods for template publishing
- Admin API endpoints for review workflow
- User notification system

### 📋 To Do
- Admin dashboard UI for reviewing templates
- Template changelog API endpoint
- Frontend "Updated" badges and version display
- User notification emails for template updates
- In-app notification display
- One-click publish workflow

## Manual Workflow (Current)

Until the admin UI is built, admins can approve template updates via database:

```sql
-- 1. View pending reviews
SELECT tr.*, t.title, lm.bill_number
FROM template_review_queue tr
JOIN templates t ON tr.template_id = t.id
JOIN legislative_monitoring lm ON tr.bill_id = lm.id
WHERE tr.status = 'pending'
ORDER BY tr.priority DESC;

-- 2. Approve and publish a template update
BEGIN;

-- Update the template
UPDATE templates
SET 
  version = version + 1,
  version_notes = 'Updated security deposit return deadline to 45 days',
  last_update_reason = 'SB 142 - Security Deposit Timeline Changes',
  updated_at = NOW()
WHERE id = '[template-id]';

-- Create version history record
INSERT INTO template_versions (template_id, version_number, pdf_url, version_notes, last_update_reason, source_review_id, created_by)
VALUES ('[template-id]', 2, '[new-pdf-url]', 'Updated security deposit return deadline to 45 days', 'SB 142', '[review-id]', '[admin-id]');

-- Mark review as published
UPDATE template_review_queue
SET 
  status = 'published',
  approval_notes = 'Reviewed with attorney, approved for publication',
  approved_at = NOW(),
  published_at = NOW(),
  published_by = '[admin-id]',
  updated_at = NOW()
WHERE id = '[review-id]';

-- Mark legislative monitoring as reviewed
UPDATE legislative_monitoring
SET 
  is_reviewed = true,
  reviewed_by = '[admin-id]',
  reviewed_at = NOW()
WHERE id = '[bill-id]';

COMMIT;

-- 3. Then manually notify users via Resend or admin interface
```

## Testing Plan

1. **Test Legislative Monitoring**:
   - Manually trigger monthly scan
   - Verify bills are queued for review
   - Check admin email sent

2. **Test Approval Workflow**:
   - Approve a pending review via API
   - Verify template version increments
   - Check version history record created
   - Confirm notifications sent to users

3. **Test User Experience**:
   - Check "Updated" badge shows on templates
   - Verify version number displays
   - Test changelog modal
   - Confirm notification emails received
   - Test in-app notifications

---

**Last Updated:** November 20, 2024  
**Status:** Core infrastructure complete, admin UI pending
