# Adding a New State to LeaseShield

This guide walks you through the complete process of adding support for a new U.S. state to LeaseShield. Follow each step carefully to ensure complete integration.

## Overview

Adding a new state requires:
1. Database setup (state record)
2. Legal template content
3. Compliance card content
4. Communication template content
5. Legal updates content
6. Verification and testing

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

## Step 7: Run Seeds

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

## Step 8: Verify Setup

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

## Step 9: Test in Application

1. Log in to the application
2. Set the new state as your preferred state
3. Navigate to Templates page - verify state templates appear
4. Navigate to Compliance page - verify compliance cards appear
5. Navigate to Communications page - verify templates appear
6. Test document generation for each template type

## Checklist

Use this checklist before considering the state complete:

- [ ] State added to `seed.ts` and database
- [ ] All required template types added
- [ ] All required compliance cards added
- [ ] All required communication templates added
- [ ] Legal updates added (if applicable)
- [ ] State disclosures added (if applicable)
- [ ] Seeds executed successfully
- [ ] Verification script passes
- [ ] Manual testing completed
- [ ] replit.md updated with new state

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
