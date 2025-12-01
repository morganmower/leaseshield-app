# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform ($10/month with 7-day free trial) designed for small and midsize landlords. Its primary purpose is to provide state-specific legal templates, compliance guidance, and tenant screening resources. The platform aims to be a "protective mentor," helping landlords safeguard their investments while ensuring compliance with legal regulations. Currently supports 5 states: Utah, Texas, North Dakota, South Dakota, and North Carolina.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
The platform utilizes a primary blue (#2563eb) and secondary slate gray (#475569) color scheme with a light gray background. Typography uses Space Grotesk for headings and Inter for body text. Common UI patterns include cards with subtle shadows, before/after comparison layouts, badge-based categorization, and icon-first navigation. The user experience maintains a "protective mentor" tone.

### Technical Implementations
- **Frontend**: Built with React, TypeScript, TanStack Query, Wouter for routing, and Shadcn UI components.
- **Backend**: An Express.js server connected to a PostgreSQL database (via Neon) using Drizzle ORM.
- **Authentication**: Managed via Replit Auth with session handling.
- **Payments**: Stripe Subscriptions are integrated for payment processing, with webhooks managing subscription lifecycle events.
- **Document Assembly Wizard**: Features interactive multi-step forms with real-time validation, server-side PDF generation using Puppeteer, and robust HTML escaping. Generated PDFs have a professional, attorney-quality appearance with specific styling (letterhead, Times New Roman, enhanced margins, formal signature blocks).
- **Legislative Monitoring**: An automated system with monthly cron jobs (LegiScan API) tracks state bills. AI (GPT-4) analyzes relevance, auto-publishes template updates with versioning, and notifies users via email.
- **Template Review & Publishing**: An atomic auto-publishing system ensures transactional updates with versioning, history tracking, automatic approval, legislative bill flagging, and immediate user notifications via Resend.
- **Email Notifications**: Integrated with a professional email service (e.g., Resend) for legal and template update notifications.
- **AI Screening Helpers**: Two AI-powered tools (GPT-4o-mini) assist with credit report analysis and criminal/eviction screening, emphasizing Fair Housing compliance. They include "Learn" and "Ask" modes, structured AI responses, and privacy protections for sensitive data.
- **AI Chat Assistant**: An integrated AI-powered chat widget (GPT-4o-mini via OpenAI) provides instant help with landlord-tenant law questions, platform features, and compliance guidance across all authenticated pages and the landing page.
- **Multi-Property Management**: Allows CRUD operations for properties, associating documents, and filtering.
- **Document Upload System**: Securely handles user uploads (PDF, DOC, DOCX up to 20MB) with custom naming, optional property association, and metadata.

### Feature Specifications
- **Subscription Management**: Offers a 7-day free trial and a $10/month subscription model, powered by Stripe Elements and webhooks.
- **Template Library**: Provides state-specific legal documents categorized by use case, available for download as PDF/DOCX.
- **Compliance Cards**: Offers state-specific "before/after" guidance, explanations, and actionable steps, with optional links to related templates.
- **Screening Toolkit**: Guides for credit reports, background checks, and Fair Housing, with CTAs for Western Verify integration and AI-powered helpers.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and document templates.
- **User Preferences**: Users can set their preferred state for personalized content filtering.
- **Admin Legislative Monitoring UI**: A dedicated admin page manages published updates, pending bills with AI analysis, and historical data.
- **Admin Resource Management**: CRUD operations for all platform content (Templates, Compliance Cards, Legal Updates) directly via the UI.

### System Design Choices
- **Deployment**: Automated deployments via Replit on push.
- **Database Schema**: Comprehensive schema covering users, states, templates, compliance cards, legal updates, analytics, screening content, tenant issue workflows, legislative monitoring data, notifications, properties, savedDocuments, and uploadedDocuments.
- **API Endpoints**: Structured API for all core functionalities including authentication, user management, subscriptions, content, legislative monitoring, and administrative tasks.

## External Dependencies
- **PostgreSQL (Neon)**: Main relational database.
- **Stripe**: Payment gateway for subscriptions.
- **Replit Auth**: User authentication service.
- **LegiScan API**: Legislative tracking and monitoring.
- **CourtListener API**: Court case and legal precedent tracking.
- **GPT-4 (OpenAI API via Replit AI Integration)**: Powers AI analysis for legislative bills.
- **Puppeteer**: Used for server-side PDF generation.
- **Western Verify LLC**: Integrated via CTAs for tenant screening services.
- **Resend**: Email service for user notifications.

---

## Adding New States - Complete Checklist

When adding a new state to LeaseShield, follow this systematic process to ensure consistent integration across the entire platform. This maintains the "simplistic and does not break anything" approach.

### Step 1: Database Seeding
**File**: `server/seed.ts`
- Add the new state code (e.g., "NC") to the `STATES` array
- Format: `{ id: "STATE_CODE", name: "State Name", stateCode: "STATE_CODE" }`
- Example: `{ id: "NC", name: "North Carolina", stateCode: "NC" }`

### Step 2: State Badge Component
**File**: `client/src/components/state-badge.tsx`
- Add a new case in the state switch statement
- Format: `case "NEW_STATE": return "State Name";`
- Example: `case "NC": return "North Carolina";`

### Step 3: Legislative Monitoring Setup
**File**: `server/legislativeMonitoring.ts`
- Add state code to the monitored states array
- Example: Add `"NC"` to states being monitored by LegiScan API

### Step 4: Court Case Tracking
**File**: `server/courtListenerService.ts`
- Add relevant court mappings for the new state
- Example for NC: Add "Court of Appeals", "Supreme Court", "4th Circuit" mappings

### Step 5: AI Chat System Prompts
**File**: `server/routes.ts`
- Update hardcoded state lists in system prompts
- Search for: `"for UT, TX, ND, and SD"` patterns
- Add the new state: `"for UT, TX, ND, SD, and NEW_STATE"`

### Step 6: Compliance Page State Tabs
**File**: `client/src/pages/compliance.tsx`
- Update TabsList grid columns: `grid-cols-4` → `grid-cols-5` (adjust count)
- Update TabsList max-width: `max-w-2xl` → `max-w-4xl` (adjust width)
- Add TabsTrigger: `<TabsTrigger value="NEW_STATE">State Name</TabsTrigger>`
- Add to state mapping array: `{["UT", "TX", "ND", "SD", "NEW_STATE"].map(...)`

### Step 7: Landing Page Updates
**File**: `client/src/pages/landing.tsx`
- Update state count statistic: `"4 States"` → `"5 States"`
- Update all template descriptions: Add new state to every `"UT, TX, ND, and SD"` reference
- Update FAQ section: Mention new state in supported states list
- Update feature descriptions and footer

### Step 8: Dashboard References
**File**: `client/src/pages/dashboard.tsx`
- Update Template Library card description
- Change: `"...for UT, TX, ND, and SD laws"` → `"...for UT, TX, ND, SD, and NEW_STATE laws"`

### Step 9: Help Center FAQs
**File**: `client/src/pages/help-center.tsx`
- Update all FAQ responses mentioning states
- Add new state to: "How do I access templates?" and "Are templates legally valid?" FAQs

### **CRITICAL Step 10: Update ALL State Selector Dropdowns**
This is the most commonly missed step. Users must be able to select the new state everywhere.

**Files to Update:**

1. **Settings Page** (`client/src/pages/settings.tsx`)
   - Find: Preferred State selector
   - Add: `<SelectItem value="NEW_STATE">State Name</SelectItem>`
   - Example: Add NC to the SelectContent

2. **Templates Page** (`client/src/pages/templates.tsx`)
   - Find: State filter selector (line ~234)
   - Add: `<SelectItem value="NEW_STATE">State Name</SelectItem>`
   - Example: Add NC after South Dakota in SelectContent

3. **Properties Page** (`client/src/pages/properties.tsx`)
   - Find: US_STATES constant (line ~18)
   - Add: `{ code: "NEW_STATE", name: "State Name" },` to array
   - Example: Add `{ code: "NC", name: "North Carolina" },`
   - This affects property creation and editing dialogs

4. **Admin Templates Page** (`client/src/pages/admin-templates.tsx`)
   - Usually fetches states from API dynamically (no change needed)
   - Verify state appears in the state selector

5. **Document Wizard** (`client/src/pages/document-wizard.tsx`)
   - Check if it has a state selector (may be optional)
   - Add new state if selector exists

**How to Find State Selectors:**
```bash
grep -r "SelectItem.*UT\|SelectItem.*Texas" client/src/pages --include="*.tsx"
grep -r "const.*STATES" client/src/pages --include="*.tsx"
grep -r "Utah.*Texas" client/src/pages --include="*.tsx"
```

### Step 11: Legal Updates Pages (DYNAMIC - NO MANUAL CHANGES NEEDED)
**Files**: `client/src/pages/legal-updates.tsx` and `client/src/pages/admin-legal-updates.tsx`
- These pages fetch states dynamically from `/api/states` endpoint
- They automatically display all states from the database
- **NO manual state selector updates required** - they will show the new state automatically after database seeding
- Verify: After adding state to database seed, these pages should show the new state without any code changes

### Verification Checklist
- [ ] State appears in database seed
- [ ] State badge displays correct name
- [ ] State included in legislative monitoring
- [ ] Court tracking configured for state
- [ ] AI chat mentions state in prompts
- [ ] Compliance page has state tab and content loads
- [ ] Landing page reflects new state count
- [ ] Dashboard descriptions updated
- [ ] Help center FAQs mention state
- [ ] Settings page has state in dropdown
- [ ] Templates page has state in dropdown
- [ ] Properties page has state in dropdown
- [ ] Admin pages show state
- [ ] Legal Updates page shows state (dynamic, verify data populates)
- [ ] Admin Legal Updates page shows state (dynamic, verify data populates)
- [ ] Document wizard (if applicable) shows state
- [ ] Workflow restarted and no errors
- [ ] Tested: Select new state and verify content appears

### Quick Reference: Files Summary
| File | Change Type | Location | Notes |
|------|------------|----------|-------|
| server/seed.ts | Array | STATES array | Creates state in database |
| client/src/components/state-badge.tsx | Switch case | State cases | Display state name |
| server/legislativeMonitoring.ts | Array | MONITORED_STATES | Bill tracking |
| server/courtListenerService.ts | Mappings | Court mappings | Case law tracking |
| server/routes.ts | String | AI system prompts | AI chat context |
| client/src/pages/compliance.tsx | Tabs + Grid | TabsList + TabsTrigger + map array | Compliance tabs |
| client/src/pages/landing.tsx | Text + Count | State references + stat numbers | Marketing content |
| client/src/pages/dashboard.tsx | Description | Template card text | Dashboard copy |
| client/src/pages/help-center.tsx | FAQ text | FAQ answer strings | FAQ responses |
| client/src/pages/settings.tsx | SelectItem | Preferences selector | State preference dropdown |
| client/src/pages/templates.tsx | SelectItem | State filter selector | Template filter dropdown |
| client/src/pages/properties.tsx | Constant | US_STATES array | Property creation dropdown |
| client/src/pages/admin-templates.tsx | Check | Verify (usually dynamic) | Fetches from API |
| client/src/pages/legal-updates.tsx | Check | Fetches from `/api/states` | Dynamic - no manual changes |
| client/src/pages/admin-legal-updates.tsx | Check | Fetches from `/api/states` | Dynamic - no manual changes |
| client/src/pages/document-wizard.tsx | Check | Verify (if applicable) | If state selector exists |
