# Adding a New State to LeaseShield

This guide walks you through the complete process of adding support for a new U.S. state to LeaseShield. Follow each step carefully to ensure complete integration.

## Overview

Adding a new state requires:
1. Database setup (state record)
2. Legal template content
3. Compliance card content
4. Communication template content
5. State disclosures for document generation
6. Decoder notes initialization
7. Legal updates content (optional)
8. Running seed scripts
9. Verification and testing
10. **Updating state counts in documentation and frontend**
11. Manual testing

## Prerequisites

- Access to the database
- Knowledge of the state's landlord-tenant laws
- Understanding of state-specific disclosures and requirements

## Step 1: Add State to Database

Add the state to `server/seed.ts` in the `seedStates` function:

```typescript
const statesData = [
  // ... existing states ...
  { id: "NY", name: "New York", isActive: true },
];
```

Then run the seed:

```bash
npx tsx server/seed.ts
```

The state registry cache (5-minute TTL) will automatically pick up the new state.

## Step 2: Add Legal Templates

Edit `server/seed-comprehensive.ts` to add templates for the new state. Each state needs these core templates:

### Core Template Types (REQUIRED - blocking issues if missing)

These are required for a state to pass verification:

| Type | Category | Purpose |
|------|----------|---------|
| `lease` | leasing | Residential lease agreement |
| `application` | screening | Rental application form |

### Recommended Template Types (non-blocking warnings if missing)

These are recommended for full coverage but won't block state activation:

| Type | Category | Purpose |
|------|----------|---------|
| `adverse_action` | screening | Adverse action notice |
| `move_in_checklist` | move_in_out | Property condition documentation |
| `move_out_checklist` | move_in_out | Move-out inspection |
| `late_rent_notice` | notices | Rent payment demand |
| `lease_violation_notice` | notices | Lease violation warning |
| `eviction_notice` | evictions | Notice to quit/vacate |

### Template Entry Format

```typescript
{
  title: "New York Residential Lease Agreement",
  description: "State-compliant lease with all NY-required disclosures",
  category: "leasing" as const,
  templateType: "lease" as const,
  stateId: "NY",
  version: 1,
  sortOrder: 1,
  isActive: true,
},
```

**Important**: The seed script automatically generates canonical keys using the pattern:
`{category}_{templateType}_{slugified_title}`

## Step 3: Add Compliance Cards

Edit `server/seed-compliance.ts` to add compliance guidance:

### Required Compliance Topics

- Security Deposit limits and return timeline
- Eviction notice requirements
- Lease disclosure requirements
- Entry notice requirements
- Fair Housing considerations
- Any state-specific requirements (e.g., rent control, mold disclosure)

### Compliance Card Format

```typescript
{
  stateId: "NY",
  title: "Security Deposit Limits and Return",
  summary: "New York limits security deposits and requires return within 14 days",
  legalAuthority: "NY General Obligations Law Section 7-108",
  keyRequirements: [
    "Maximum deposit: One month's rent (for rent-regulated units)",
    "Return deadline: 14 days after lease termination",
    "Itemized statement required for any deductions",
  ],
  actionableSteps: [
    "Collect security deposit at lease signing",
    "Provide receipt for deposit",
    "Conduct documented move-out inspection",
    "Return deposit with itemization within 14 days",
  ],
  effectiveDate: new Date("2024-01-01"),
  isActive: true,
},
```

## Step 4: Add Communication Templates

Edit `server/seed-communications.ts` to add landlord communications:

### Required Communication Types

| Type | Purpose |
|------|---------|
| `welcome_letter` | New tenant onboarding |
| `rent_reminder` | Payment reminder |
| `lease_renewal` | Renewal offer |
| `maintenance_response` | Work order acknowledgment |
| `late_rent_notice` | Late payment warning |

### Communication Template Format

```typescript
{
  title: "New York Welcome Letter",
  description: "Professional welcome letter for new NY tenants",
  templateType: "welcome_letter" as const,
  stateId: "NY",
  subject: "Welcome to Your New Home at {{property_address}}",
  body: `Dear {{tenant_name}},

Welcome to your new home at {{property_address}}!...`,
  mergeFields: ["tenant_name", "property_address", "landlord_name", "landlord_phone", "landlord_email"],
  category: "tenant_relations" as const,
  isActive: true,
  version: 1,
  sortOrder: 1,
},
```

## Step 5: Add Legal Updates (Optional)

Edit `server/seed-legal-updates.ts` if there are recent legal changes:

```typescript
{
  stateId: "NY",
  title: "Good Cause Eviction Law Takes Effect",
  summary: "New protections for tenants in buildings with 10+ units",
  content: "Detailed explanation of the new law...",
  effectiveDate: new Date("2024-04-20"),
  source: "NY Housing Stability and Tenant Protection Act",
  category: "eviction" as const,
  importance: "high" as const,
},
```

## Step 6: Add State Disclosures (For Document Generation)

If the state has specific disclosures for lease documents, add them to `server/templates/disclosures.ts`:

```typescript
export const stateDisclosures: Record<string, StateDisclosure[]> = {
  // ... existing states ...
  "NY": [
    {
      title: "Lead Paint Disclosure",
      content: "For pre-1978 housing, landlord must disclose known lead-based paint...",
      required: true,
      statute: "24 CFR Part 35",
    },
    // Add more NY-specific disclosures
  ],
};
```

## Step 7: Initialize Decoder Notes

After adding the state, create decoder note placeholders so admins can see coverage gaps:

```bash
# Initialize decoder notes for the new state
npx tsx server/scripts/initStateNotes.ts NY
```

This creates draft placeholders for all required decoder topics:
- Criminal/Eviction: fair_chance_housing, individualized_assessment, local_overrides_present
- Credit: source_of_income (if state has SOI protections)

**Important**: This does NOT create legal content - just empty slots for admins to fill and approve later.

### Filling Decoder Notes

1. Go to Admin → State Notes → Coverage tab
2. Find the new state in the matrix (red cells = required topics missing)
3. Click "Create Draft" or edit existing placeholder
4. Add vetted content with source citations
5. Submit for review → Approve with legal checklist
6. Run verification: `npx tsx server/scripts/verifyStateNotes.ts NY`

### Decoder Notes Checklist

- [ ] Run `initStateNotes <STATE>` to create placeholders
- [ ] In Admin → State Notes Coverage, confirm required topics exist
- [ ] Add bullets + sources for required topics (at minimum)
- [ ] Submit → Approve each required topic
- [ ] Run `verifyStateNotes <STATE>` to confirm all required approved
- [ ] Smoke test: ask a state-law question and confirm:
  - Approved note appears in decoder
  - Missing note triggers fallback sentence

## Step 8: Run Content Seeds

After adding all content, run the seed scripts:

```bash
# Seed comprehensive templates
npx tsx server/seed-comprehensive.ts

# Seed compliance cards
npx tsx server/seed-compliance.ts

# Seed communication templates
npx tsx server/seed-communications.ts

# Seed legal updates (if added)
npx tsx server/seed-legal-updates.ts
```

## Step 9: Verify Setup

Run the verification script to ensure complete setup:

```bash
# Verify specific state
npx tsx server/scripts/verifyStateSetup.ts NY

# Verify all states
npx tsx server/scripts/verifyStateSetup.ts
```

The script checks for:
- Required template types present
- Required compliance topics covered
- Communication templates available
- All entries have canonical keys
- State is marked as active

### Expected Output

```
============================================================
STATE SETUP VERIFICATION REPORT
============================================================

[v] NY - New York [ACTIVE]
    Templates: 12 | Compliance: 8 | Communications: 5 | Legal Updates: 2
```

## Step 10: Update State Counts and Documentation

After adding a new state, update all locations that reference the total number of supported states:

### Files to Update

#### ⚠️ CRITICAL: Document Generator Files (Downloads will FAIL without these!)

These files contain hardcoded state maps. **If you don't update these, template downloads will fail for the new state.**

| File | Constant(s) | What to Add |
|------|-------------|-------------|
| `server/utils/leaseAgreementGenerator.ts` | `STATE_NAMES`, `DEPOSIT_RETURN_DAYS` | State code → state name, deposit return days |
| `server/utils/blankApplicationGenerator.ts` | `STATE_NAMES` | State code → state name |
| `server/utils/moveOutChecklistGenerator.ts` | `STATE_NAMES` | State code → state name |
| `server/aiContentService.ts` | `STATE_NAMES` | State code → state name |
| `server/pluralPolicyService.ts` | `STATE_JURISDICTION_MAP` | State code → jurisdiction ID |
| `server/legislation/sources/adapters/pluralPolicyAdapter.ts` | `STATE_JURISDICTION_MAP` | State code → jurisdiction ID (format: `ocd-jurisdiction/country:us/state:XX/government`) |
| `client/src/components/state-badge.tsx` | `STATE_NAMES` | State code → state name (for UI display) |

**Example additions:**
```typescript
// In leaseAgreementGenerator.ts STATE_NAMES:
NM: 'New Mexico',

// In leaseAgreementGenerator.ts DEPOSIT_RETURN_DAYS:
NM: '30',

// In pluralPolicyAdapter.ts STATE_JURISDICTION_MAP:
NM: 'ocd-jurisdiction/country:us/state:nm/government',
```

#### Documentation & Frontend Files

| File | Location | What to Update |
|------|----------|----------------|
| `replit.md` | Line ~4 (Overview section) | Update "supports X states" count and state list |
| `replit.md` | Line ~74 (State-specific content) | Update "All X states have comprehensive disclosures" |
| `README.md` | Line ~185 (Roadmap Phase 1) | Update "Core templates for X states" |
| `progress.md` | Line ~93 (Template Features) | Update "State-specific versions (X states)" |
| `progress.md` | Line ~489 (Notes section) | Update "All X states have templates" |
| `docs/document-download-tests.md` | Lines ~196-199 | Update regression test checklist state counts |
| `client/src/pages/landing.tsx` | Line ~37 (STATES array) | Add new state name to the array |
| `client/src/pages/landing.tsx` | Line ~2310 (Footer States list) | Add new state name to footer list |
| `client/src/pages/disclaimers.tsx` | Line ~144 | Update state count in legal disclaimer |
| `client/src/pages/help-center.tsx` | Lines ~57, ~61 | Update state count and template count in FAQ |
| `client/src/pages/rental-applications.tsx` | US_STATES array | Add new state code and name |
| `server/seed.ts` | statesData array | Add new state entry |
| `server/seed-communications.ts` | STATE_STATUTE_REFS | Add state code and statute reference |
| `server/states/disclosures.ts` | STATE_DISCLOSURE_REGISTRY | Add state disclosures for document generation |

### Quick Update Commands

After adding all state content, use these search commands to find hardcoded state counts and state maps:

```bash
# Find hardcoded "X states" references (update with current count)
grep -rn "15 states\|16 states\|17 states" --include="*.md" --include="*.tsx" --include="*.ts"

# Find state arrays that may need updating
grep -rn "const STATES\|US_STATES\|statesData" --include="*.tsx" --include="*.ts"

# CRITICAL: Find document generator STATE_NAMES maps (MUST update for downloads to work)
grep -rn "STATE_NAMES.*Record\|DEPOSIT_RETURN_DAYS\|STATE_JURISDICTION_MAP" server/utils/ server/legislation/
```

### Template Count Note

The template count on the landing page is dynamic (fetched from `/api/stats/template-count`), but the fallback value in `client/src/pages/landing.tsx` should be updated if significantly different from the actual count after seeding.

## Step 11: Test in Application

1. Log in to the application
2. Set the new state as your preferred state
3. Navigate to Templates page - verify state templates appear
4. Navigate to Compliance page - verify compliance cards appear
5. Navigate to Communications page - verify templates appear
6. Test document generation for each template type

## Checklist

Use this checklist before considering the state complete:

### Data & Content
- [ ] State added to `seed.ts` and database
- [ ] All required template types added to `seed-comprehensive.ts`
- [ ] All required compliance cards added to `seed-compliance.ts`
- [ ] State statute reference added to `seed-communications.ts`
- [ ] State disclosures added to `server/states/disclosures.ts`
- [ ] Legal updates added (if applicable)
- [ ] Seeds executed successfully

### ⚠️ CRITICAL: Document Generator & Service Updates (Downloads break without these!)
- [ ] **STATE_NAMES map updated** in `server/utils/leaseAgreementGenerator.ts`
- [ ] **DEPOSIT_RETURN_DAYS map updated** in `server/utils/leaseAgreementGenerator.ts`
- [ ] **STATE_NAMES map updated** in `server/utils/blankApplicationGenerator.ts`
- [ ] **STATE_NAMES map updated** in `server/utils/moveOutChecklistGenerator.ts`
- [ ] **STATE_NAMES map updated** in `server/aiContentService.ts`
- [ ] **STATE_JURISDICTION_MAP updated** in `server/pluralPolicyService.ts`
- [ ] **STATE_JURISDICTION_MAP updated** in `server/legislation/sources/adapters/pluralPolicyAdapter.ts`
- [ ] **STATE_NAMES map updated** in `client/src/components/state-badge.tsx`

### Decoder Notes
- [ ] **Decoder Notes initialized** (`initStateNotes.ts <STATE>`)
- [ ] **Required decoder topics approved** (fair_chance_housing, individualized_assessment, local_overrides_present)
- [ ] **Decoder notes verification passes** (`verifyStateNotes.ts <STATE>`)

### Frontend Updates
- [ ] State added to STATES array in `client/src/pages/landing.tsx`
- [ ] State added to footer States list in `client/src/pages/landing.tsx`
- [ ] State count updated in `client/src/pages/disclaimers.tsx`
- [ ] State added to US_STATES in `client/src/pages/rental-applications.tsx`
- [ ] Template count fallback updated in `landing.tsx` (if significantly different)

### Documentation Updates (State Counts)
- [ ] `replit.md` Overview - update state count and list
- [ ] `replit.md` State-specific content - update "All X states"
- [ ] `README.md` Roadmap Phase 1 - update state count
- [ ] `progress.md` Template Features - update state count
- [ ] `progress.md` Notes section - update state count
- [ ] `docs/document-download-tests.md` - update regression test counts

### Verification
- [ ] Verification script passes (`verifyStateSetup.ts <STATE>`)
- [ ] Manual testing completed (including decoder smoke test)
- [ ] Landing page shows correct state count

## Troubleshooting

### State not appearing in dropdowns
The state registry has a 5-minute cache. Either wait or restart the server.

### Duplicate key errors during seed
The seed scripts use upsert pattern. If you see duplicate key errors, check:
- The `key` column is properly backfilled
- Unique constraints are in place
- Run the duplicate cleanup script if needed

### Templates not generating correctly
Check that state disclosures are properly configured in `disclosures.ts`.

## State Registry Architecture

LeaseShield uses a database-driven state registry with caching:

- **Source of Truth**: `states` table in PostgreSQL
- **Cache**: 5-minute TTL via memoizee
- **Access**: `getActiveStateIds()` from `server/states/getActiveStates.ts`

When you add a new state to the database, all systems automatically include it:
- Legislative monitoring
- User preferences validation
- Template filtering
- Compliance card filtering

---

## Adding an Official Court Form (PDF Overlay Mode)

Official court forms (eviction notices, demand letters issued by state court authorities) follow a strict **PDF overlay** architecture. The output must be the official base PDF filled with user data — no LeaseShield headers, footers, metadata, or branding. This section documents the complete workflow.

### Architecture Overview

```
User submits wizard form
       ↓
DocumentRenderer (server/engine/documentRenderer.ts)
       ↓ reads template.output_template_id
       ↓
OfficialOverlayRenderer (server/engine/officialOverlayRenderer.ts)
       ↓
Strategy A: form_fields  → fill AcroForm fields by name (preferred)
Strategy B: coordinates  → draw text at x/y coordinates (fallback)
       ↓ mandatory flatten
       ↓
OverlayGuardrails        → page count check, banned string scan
       ↓
Buffer returned to user (official PDF, no LeaseShield content)
```

### Step 1: Download and Place the Official PDF

```bash
# Place the official PDF in the court-forms assets directory
# Naming convention: {STATE}_{form_id}.pdf
server/assets/court-forms/{STATE}_{form_id}.pdf

# Example:
server/assets/court-forms/MI_DC_100a.pdf
```

Use only the official, unmodified PDF from the state court authority. Never use a recreated or reformatted version.

### Step 2: Inspect AcroForm Fields

Run the inspect utility to discover what fields the PDF contains:

```bash
npx tsx server/scripts/inspectPdfFields.ts server/assets/court-forms/{STATE}_{form_id}.pdf
```

This will output:
- Total page count and MediaBox dimensions per page
- All AcroForm field names, types (TextField/CheckBox), and bounding rectangles
- A field name mapping template (ready to copy into your seed/renderer code)
- A recommendation: `form_fields` (if AcroForm fields exist) or `coordinates` (if not)

Example output for a field:
```
[TextField   ] "First Middle and Last Name"  → page rect: x=153.1, y=528.7, w=248.5, h=11.9
```

### Step 3: Choose Render Strategy

| Condition | Strategy |
|-----------|----------|
| PDF has usable named AcroForm fields | `form_fields` (primary) |
| PDF has no AcroForm or fields are unnamed/broken | `coordinates` (fallback) |

For `coordinates` strategy, use the x/y/page values from the inspect utility to build `overlay_fields` DB rows.

### Step 4: Create the Notice Form Definition

Create database records for the form:

```sql
-- 1. notice_forms
INSERT INTO notice_forms (id, state_id, key, display_name, notice_category, is_active)
VALUES (gen_random_uuid(), '{STATE}', '{state}_{form_id}_{notice_type}',
        '{Full Display Name}', '{notice_category}', true);

-- 2. notice_form_versions (status = 'approved' to be active)
INSERT INTO notice_form_versions (id, form_id, version_number, status)
VALUES (gen_random_uuid(), '<form_id>', 1, 'approved');

-- 3. output_templates (include field_map_json for form_fields strategy)
INSERT INTO output_templates (id, form_version_id, mode, base_pdf_attachment_path, render_strategy, page_count, field_map_json)
VALUES (gen_random_uuid(), '<version_id>',
        'official_pdf_overlay',
        'server/assets/court-forms/{STATE}_{form_id}.pdf',
        'form_fields',  -- or 'coordinates'
        {page_count},
        '{"plaintiff_name": "Exact PDF Field Name", "defendant_name": "Another PDF Field"}'::jsonb
       );
```

### Step 5: Create the Field Name Mapping (Strategy A — form_fields)

**Field maps live in the database — no code changes required.**

The `field_map_json` JSONB column on `output_templates` maps `field_key` (the user input key) to the exact AcroForm field name in the PDF. Use the output from `inspectPdfFields.ts` to build this mapping.

```sql
-- Update an existing output_template with the field map:
UPDATE output_templates
SET field_map_json = '{
  "plaintiff_name": "Exact PDF Field Name Here",
  "defendant_name": "Another Exact PDF Field Name"
}'::jsonb
WHERE id = '<output_template_id>';
```

Key rules for `field_map_json`:
- **Keys** = `field_key` values from `form_fields` or dynamic values (e.g., `compliance_deadline`, `service_checkbox_personal`)
- **Values** = exact AcroForm field names from the PDF (copy exactly from `inspectPdfFields.ts` output, including spaces and special characters)
- Text fields: renderer calls `form.getTextField(pdfFieldName).setText(value)`
- Checkboxes: renderer calls `form.getCheckBox(pdfFieldName).check()` when value is `'X'`, `'x'`, `'true'`, or `'1'`
- If a key is in `field_map_json` but the field doesn't exist in the PDF, a warning is logged and rendering continues

> **Note:** The legacy `MI_DC100A_FIELD_MAP` constant in `officialOverlayRenderer.ts` is kept as a fallback only for backward compatibility. All new forms must use `field_map_json` in the DB. Never add new in-code field map constants.

If using `coordinates` strategy (no AcroForm fields), insert rows into `overlay_fields` instead of using `field_map_json`:

```sql
INSERT INTO overlay_fields (id, output_template_id, field_key, page_number, x, y, font, font_size, max_width, align, wrap)
VALUES (gen_random_uuid(), '<output_template_id>', 'plaintiff_name', 1, 40, 701, 'Helvetica', 9, 285, 'left', false);
-- (repeat for each field)
```

Coordinates (x, y) are in PDF points from the bottom-left of each page. Use `inspectPdfFields.ts` field bounding boxes as reference for nearby coordinates, or use the PDF viewer ruler tool.

### Step 6: Link the Library Template

After creating the `output_templates` record, link your LeaseShield library template to it:

```sql
UPDATE templates
SET output_template_id = '<output_template_id>'
WHERE state_id = '{STATE}' AND key = '{template_key}';
```

Or update the migration script (`server/scripts/migrateRendererSchema.ts`) to include the link.

### Step 7: Run the Smoke Test

Run the automated smoke test against the new form:

```bash
npx tsx server/scripts/testOverlayOutput.ts
```

For new forms, update `testOverlayOutput.ts` with:
1. The correct `BASE_PDF_PATH`
2. `TEST_FIELDS` matching the new form's field keys
3. `testFieldAssertions` with the exact AcroForm field names and expected values

The smoke test verifies:
- Page count equals base PDF ✓
- MediaBox dimensions match per page ✓
- Output SHA-256 differs from base (fields were written) ✓
- No banned strings in output (no LeaseShield metadata) ✓
- Expected field values were written correctly ✓

**The smoke test must pass before any form goes to production.**

If it fails, a debug artifact is saved as `test_output_FAILED_{timestamp}.pdf` for visual inspection.

### Step 8: Add Form-Specific Banned Strings (Optional)

If the new form's official template includes strings that should never appear in output (e.g., placeholder text like "INSERT NAME HERE"), add them to `overlayGuardrails.ts`:

```typescript
const BANNED_STRINGS = [
  'LeaseShield',
  // ... existing entries ...
  'INSERT NAME HERE',  // form-specific placeholder
];
```

### Step 9: Holiday Calendar (If Applicable)

If the notice period calculation depends on court holidays (e.g., court filing deadlines):

1. Check if `notice_form_versions.statute_snapshot_text` references holiday exclusions
2. Wire the form to the existing holiday calendar in `server/engine/dateEngine.ts`
3. Document which calendar applies in the form's `statute_retrieved_at` / `statute_source_citation` fields

---

## Official Court Form Registry

Current implementation status as of March 2026. Every form listed here uses `official_pdf_overlay` with a mandatory flatten; zero LeaseShield branding or metadata is present in the output.

| Form | State | Strategy | PDF Asset | Smoke Test | Notes |
|------|-------|----------|-----------|------------|-------|
| MI SCAO DC 100a — Demand for Possession | MI | `form_fields` | `MI_DC_100a.pdf` | `testDC100aOverlay.ts` (13/13 ✓) | AcroForm; field_map_json in DB |
| MI SCAO DC 100c — Complaint Land Contract Forfeiture | MI | `form_fields` | `MI_DC_100c.pdf` | `testDc100cOutput.ts` | AcroForm; field_map_json in DB; library template key: `evictions_mi_dc_100c_land_contract_complaint` |
| SD UJS-112 — Verified Complaint for Eviction | SD | `coordinates` | `SD_verified_complaint.pdf` | `testSDOverlayOutput.ts` (6/6 ✓) | No AcroForm; 12 overlay_fields rows; 4 pages; fields on pages 2 & 4 |
| UT 1100EVJ — Complaint for Unlawful Detainer | UT | `coordinates` | `UT_complaint_unlawful_detainer.pdf` | `testUTOverlayOutput.ts` (6/6 ✓) | No AcroForm; 16 overlay_fields rows; 9 pages; fields on pages 1 & 2 |

**Blocked (no statewide public PDF available):**
- **OH** — Eviction Summons and Complaint: Ohio uses county-level forms; no single statewide PDF is publicly accessible. Remains `leaseshield_formatted`.
- **ID** — Complaint for Forcible Detainer: Idaho Supreme Court self-help forms were not accessible at isc.idaho.gov at the time of investigation (all URLs returned 404). Remains `leaseshield_formatted`. Re-check when isc.idaho.gov forms become available.

---

### Architecture Rules (Never Violate These)

- **No state-based branching in rendering code**: `officialOverlayRenderer.ts` must not contain `if (state === 'MI')` conditionals. Use form-specific field maps selected by base PDF path or config.
- **Never call Puppeteer/HTML generator for official PDFs**: The `official_pdf_overlay` code path must only use pdf-lib. No `generateDocument()` or `generateHTMLFromTemplate()` calls.
- **Always flatten**: Never return an unflatened overlay. Courts and PDF viewers show blank fields without flatten.
- **Page count must match**: If the output has a different page count than the base PDF, the renderer throws before the PDF reaches the user.
- **No LeaseShield metadata**: Verify with the banned string guardrails on every new form.
