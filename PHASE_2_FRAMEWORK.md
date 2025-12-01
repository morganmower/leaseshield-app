# Phase 2 Implementation Framework
## Value-Add Features (After MVP Launch)

---

## 1. COMMUNICATION TEMPLATES

### What It Does
Pre-written, customizable templates for landlord-to-tenant communication (rent reminders, welcome letters, lease renewals). Users fill in names/amounts/dates and copy/download to send.

### Database Changes
**New Table: `communication_templates`**
```
- id (PK)
- state_id (FK)
- template_type (enum: rent_reminder, welcome_letter, lease_renewal_notice, late_payment_notice, move_in_welcome)
- title (e.g., "Professional Rent Reminder - Past Due")
- body_text (text with {{merge_fields}} like {{tenant_name}}, {{amount_due}}, {{due_date}})
- created_at, updated_at
- is_active (bool)
```

### Frontend Implementation
**New Page: `/communications`**
- Grid of template cards by state (similar to templates page)
- Click → Opens modal with:
  - Template body (read-only preview)
  - Form fields to fill in {{merge_fields}} (auto-populated from logged-in user + selected property)
  - "Copy to Clipboard" button
  - "Download as .txt" button
- No complexity: just text substitution

### Backend
**New Route: `POST /api/communications/preview`**
- Input: template_id, user_id, property_id, custom_fields (overrides)
- Output: Rendered text with all merge fields filled
- Simple text substitution logic

### Timeline: 2-3 days
**Why it's easy:**
- No database mutations (read-only templates)
- Just form handling + text replacement
- Reuses existing state/property data

---

## 2. RENT LEDGER TEMPLATE

### What It Does
Help landlords track monthly rent received, expenses, late payments. Could be downloadable Excel or simple in-app view.

### Two Implementation Paths (Choose Based on Feedback)

#### Path A: Downloadable Excel Template (FASTEST - Week 1)
- Create pre-built Excel file with:
  - Monthly rows (Jan-Dec)
  - Columns: Date Received, Amount, Expected, Late?, Notes
  - SUM formulas for total collected/owed
- User downloads from app → Fills manually in Excel
- **Backend:** Simple file download route
- **Frontend:** One button "Download Rent Ledger"

#### Path B: In-App Tracking (SLOWER - Week 3-4)
- New table: `rent_records`
  - property_id, date_paid, amount_expected, amount_received, is_late, notes
- New page: `/rent-ledger` with monthly view
- Simple CRUD operations
- Dashboard widget showing "Rent collected this month"

### Database (Path B only)
```
- id (PK)
- property_id (FK)
- year (int)
- month (int)
- amount_expected (decimal)
- amount_received (decimal)
- date_paid (timestamp)
- is_late (bool)
- notes (text)
- created_at, updated_at
```

### Recommendation: START with Path A
- Deploy in days, not weeks
- See if users actually need tracking
- Upgrade to Path B only if multiple users request it

### Timeline: 
- **Path A (Excel template):** 1 day
- **Path B (In-app):** 3-4 days

---

## 3. SIMPLE MAINTENANCE GUIDANCE

### What It Does
Educational guides + templates for handling maintenance requests. Decision tree: "Is it urgent?" → Guide → Download notice template if needed.

### Database Changes
**New Table: `maintenance_guides`**
```
- id (PK)
- state_id (FK)
- title (e.g., "How to Handle an Urgent Repair Request")
- category (enum: urgent, routine, tenant_requested, habitability)
- content (markdown/text - step-by-step guide)
- decision_tree_path (e.g., "urgent" vs "routine" branches)
- related_template_type (links to communication template for follow-up notice)
- is_active (bool)
```

**Seed Data (4-6 guides per state):**
1. "Urgent Repairs (24-hour response)" → Link to "Urgent Repair Notice" template
2. "Routine Maintenance (tenant requested)" → Link to "Maintenance Follow-up" template
3. "Habitability Issues (legal requirement)" → Link to compliance card
4. "Tenant Damage vs Normal Wear" → No template needed (educational only)

### Frontend Implementation
**New Page: `/maintenance`**

Simple accordion or tabs:
```
Urgent Repairs (immediate action required)
  → Step 1: Assess safety risk
  → Step 2: Contact emergency contractor
  → Step 3: Document with photos
  → Download Template: Urgent Repair Notice

Routine Maintenance
  → Step 1: Review lease requirements
  → Step 2: Schedule with tenant
  → Step 3: Complete by due date
  → Download Template: Maintenance Confirmation

Tenant Damage vs Wear & Tear
  → Educational guide only (no template)
```

### Backend
**No new API needed initially.** 
- Guides are stored in DB, fetched via existing read route
- Templates link back to existing communication_templates

### Timeline: 3-4 days
**Why it's medium effort:**
- Content creation (writing guides) is the heavy lifting
- Frontend is simple accordion/cards
- DB schema is straightforward
- No complex logic

---

## IMPLEMENTATION ORDER (Recommended)

### Week 1: Communication Templates
1. Create `communication_templates` table
2. Seed 3-4 templates per state (rent reminder, welcome, lease renewal)
3. Build `/communications` page with merge field form
4. Add "Copy to Clipboard" + "Download" buttons

### Week 2: Rent Ledger (Path A - Quick Win)
1. Create Excel template file
2. Add `/downloads/rent-ledger.xlsx` route
3. Add button to dashboard → Download

### Week 3: Maintenance Guidance
1. Create `maintenance_guides` table
2. Write 4-6 guides per state (or 4-6 universal guides)
3. Build `/maintenance` page with accordion
4. Link guides to existing communication templates

---

## DATABASE UPDATES

```sql
-- Add to schema.ts

// Communication Templates
export const communicationTemplates = pgTable('communication_templates', {
  id: serial().primaryKey(),
  stateId: varchar().references(() => states.id),
  templateType: varchar().notNull(), // 'rent_reminder', 'welcome_letter', etc
  title: varchar().notNull(),
  bodyText: text().notNull(), // Contains {{merge_fields}}
  createdAt: timestamp().default(sql`now()`),
  updatedAt: timestamp().default(sql`now()`),
  isActive: boolean().default(true),
});

// Maintenance Guides
export const maintenanceGuides = pgTable('maintenance_guides', {
  id: serial().primaryKey(),
  stateId: varchar().references(() => states.id),
  title: varchar().notNull(),
  category: varchar().notNull(), // 'urgent', 'routine', 'habitability'
  content: text().notNull(), // Markdown content
  relatedTemplateType: varchar(), // Links to communication_templates
  createdAt: timestamp().default(sql`now()`),
  updatedAt: timestamp().default(sql`now()`),
  isActive: boolean().default(true),
});

// Rent Records (Optional - only for Path B)
export const rentRecords = pgTable('rent_records', {
  id: serial().primaryKey(),
  propertyId: serial().references(() => properties.id),
  year: integer().notNull(),
  month: integer().notNull(),
  amountExpected: decimal().notNull(),
  amountReceived: decimal(),
  datePaid: timestamp(),
  isLate: boolean().default(false),
  notes: text(),
  createdAt: timestamp().default(sql`now()`),
  updatedAt: timestamp().default(sql`now()`),
});
```

---

## FRONTEND STRUCTURE

### New Pages
```
/communications
  ├── State selector (tabs)
  ├── Template grid
  └── Modal (preview + form fill + download)

/maintenance
  ├── State selector (tabs)
  ├── Accordion/tabs by category
  └── Download template button

/rent-ledger (OPTIONAL - Path B only)
  ├── Property selector
  ├── Monthly table view
  └── Add/Edit rent record buttons
```

### Navigation Updates
- Add to sidebar: "Communications" and "Maintenance"
- Optional: "Rent Ledger" link

---

## ROLLOUT STRATEGY

1. **Launch with Communication Templates** (lowest effort, high perceived value)
2. **Add Rent Ledger Template download** (1 day for quick win)
3. **Add Maintenance Guidance** (requires content creation)
4. **Upgrade Rent Ledger to in-app tracking** (only if users ask for it)

---

## EFFORT ESTIMATES

| Feature | Frontend | Backend | Content | Total |
|---------|----------|---------|---------|-------|
| Communication Templates | 2 days | 1 day | 1 day (seed templates) | **3-4 days** |
| Rent Ledger (Path A) | 0.5 day | 0.5 day | 0 days | **1 day** |
| Rent Ledger (Path B) | 2 days | 1 day | 0 days | **3 days** |
| Maintenance Guides | 2 days | 0.5 day | 2 days (write guides) | **3-4 days** |
| **Total (A+Guides)** | - | - | - | **7-9 days** |
| **Total (B+Guides)** | - | - | - | **10-13 days** |

---

## QUICK WIN: Start Communication Templates Week 1
- Highest ROI (quick to build, high user value)
- Users can immediately use them
- Foundation for Maintenance Guides (which link to templates)
