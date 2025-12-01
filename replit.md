# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform designed for small and midsize landlords. It provides state-specific legal templates, compliance guidance, and tenant screening resources to help landlords protect their investments and ensure legal compliance. The platform currently supports 6 states: Utah, Texas, North Dakota, South Dakota, North Carolina, and Ohio.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
The platform uses a blue and slate gray color scheme with a light gray background. Typography is Space Grotesk for headings and Inter for body text. UI patterns include cards with shadows, before/after comparisons, badge-based categorization, and icon-first navigation, all maintaining a "protective mentor" tone.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter, Shadcn UI.
- **Backend**: Express.js, PostgreSQL (Neon), Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions for processing and webhooks for lifecycle events.
- **Document Assembly Wizard**: Interactive multi-step forms with real-time validation, server-side PDF generation (Puppeteer) with professional, attorney-quality styling, and robust HTML escaping.
- **Legislative Monitoring**: Automated system (LegiScan API) tracks state bills monthly. GPT-4 analyzes relevance, auto-publishes template updates with versioning, and notifies users.
- **Template Review & Publishing**: Atomic auto-publishing system with transactional updates, versioning, history tracking, automatic approval, legislative bill flagging, and user notifications via Resend.
- **Email Notifications**: Integrated with Resend for legal and template update notifications.
- **AI Screening Helpers**: GPT-4o-mini powered tools for credit report and criminal/eviction screening, emphasizing Fair Housing compliance, with "Learn" and "Ask" modes and privacy features.
- **AI Chat Assistant**: Integrated GPT-4o-mini chat widget (OpenAI) for instant help on landlord-tenant law and platform features.
- **Multi-Property Management**: CRUD operations for properties, document association, and filtering.
- **Document Upload System**: Securely handles user uploads (PDF, DOC, DOCX up to 20MB) with custom naming, optional property association, and metadata.
- **Compliance Toolkit**: Interactive cards displaying state-specific legal requirements, statute citations, key requirements, and actionable steps.

### Feature Specifications
- **Subscription Management**: 7-day free trial, $10/month subscription via Stripe.
- **Template Library**: State-specific legal documents (PDF/DOCX) categorized by use case, including form fields for all compliance requirements and state statute references.
- **Compliance Cards**: Detailed state-specific guidance with legal authority (statute citations), key requirements, and actionable steps.
- **Screening Toolkit**: Guides for credit reports, background checks, and Fair Housing, with CTAs for Western Verify integration and AI helpers.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and document templates.
- **User Preferences**: Allows users to set a preferred state for personalized content.
- **Admin Legislative Monitoring UI**: Manages published updates, pending bills with AI analysis, and historical data.
- **Admin Resource Management**: CRUD operations for all platform content (Templates, Compliance Cards, Legal Updates).

### System Design Choices
- **Deployment**: Automated deployments via Replit.
- **Database Schema**: Comprehensive schema for users, states, templates (with state-compliant legal text), compliance cards (with statute citations and detailed requirements), legal updates, analytics, screening content, tenant issue workflows, legislative monitoring data, notifications, properties, savedDocuments, and uploadedDocuments.
- **API Endpoints**: Structured API for all core functionalities.
- **Template Alignment**: Templates include form fields and legal text that align with all compliance card requirements for each state, ensuring consistent and compliant information.

## External Dependencies
- **PostgreSQL (Neon)**: Relational database.
- **Stripe**: Payment gateway.
- **Replit Auth**: User authentication.
- **LegiScan API**: Legislative tracking.
- **CourtListener API**: Court case and legal precedent tracking.
- **GPT-4 (OpenAI API via Replit AI Integration)**: AI analysis.
- **Puppeteer**: Server-side PDF generation.
- **Western Verify LLC**: Tenant screening services (via CTAs).
- **Resend**: Email notifications.

## Vault: Step-by-Step Process for Adding a New State

This is the documented process for adding a new state to LeaseShield. Follow these steps in order to ensure complete and consistent implementation.

### Step 1: Research State Requirements
- Search for state's landlord-tenant laws, statute codes, security deposit requirements, eviction procedures
- Document statute citations (e.g., "Ohio Rev. Code § 5321.16")
- Identify required disclosures (lead-based paint, military rights, landlord contact info, etc.)
- Note state-specific procedures (notice periods, eviction timelines, interest requirements)

### Step 2: Create 4 Compliance Cards (SQL insert into `compliance_cards` table)
Each compliance card should include:
- **title**: Card name (e.g., "Required Lease Disclosures")
- **summary**: Brief description
- **category**: One of: disclosures, deposits, evictions, fair_housing
- **content**: JSONB field with structure:
  ```json
  {
    "statutes": ["Statute Code § 123", "Another § Code"],
    "requirements": ["Requirement 1", "Requirement 2"],
    "actionableSteps": ["Step 1", "Step 2"]
  }
  ```
- **sort_order**: 1-4 (determines display order)
- **is_active**: true

### Step 3: Create 7 Templates (SQL insert into `templates` table)
Create all 7 template types aligned with compliance card requirements:
1. Residential Lease Agreement (category: leasing, template_type: lease)
2. Month-to-Month Rental Agreement (category: leasing, template_type: lease)
3. Rental Application (category: screening, template_type: application)
4. Move-In Checklist (category: move_in_out, template_type: move_in_checklist)
5. Three-Day Notice to Pay or Quit (category: notices, template_type: eviction_notice)
6. Thirty-Day Notice for Lease Violation (category: notices, template_type: lease_violation_notice)
7. Eviction Summons and Complaint (category: notices, template_type: eviction_notice)

Each template includes:
- **fillable_form_data**: JSONB with form fields including state-required disclosures and fields
- **state_id**: The state code (e.g., "OH")
- **version**: 1
- **is_active**: true

### Step 4: Add 2-3 Legal Updates (SQL insert into `legal_updates` table)
Create recent/relevant legal updates for the state:
- **title**: Update name
- **summary**: Brief description
- **why_it_matters**: Impact on landlords
- **before_text**: Previous requirement/practice
- **after_text**: Current requirement/practice
- **effective_date**: When update took effect (format: 'YYYY-MM-DD'::timestamp)
- **impact_level**: high/medium/low
- **is_active**: true

### Step 4.5: AI Screening Helpers (Automatic - No Additional Setup Required)
All new states automatically receive AI screening helper access at no additional configuration cost. These are federal/universal tools:

**AI Credit Report Helper**
- Explains credit report terminology using GPT-4o-mini
- Emphasizes Fair Housing Act compliance
- Provides "Learn" mode with credit basics and "Ask" mode for specific questions
- File: `client/src/pages/screening.tsx` (API endpoint: `/api/explain-credit-term`)
- Privacy: Blocks SSNs and account numbers automatically
- Rate limited to prevent abuse

**AI Criminal & Eviction Helper**
- Explains criminal records and eviction terminology using GPT-4o-mini
- Emphasizes Fair Housing compliance and avoiding discrimination
- Provides "Learn" mode with criminal/eviction basics and "Ask" mode for specific questions
- File: `client/src/pages/screening.tsx` (API endpoint: `/api/explain-criminal-eviction-term`)
- Privacy: Blocks SSNs and sensitive identifiers automatically
- Rate limited to prevent abuse

**Why No State Configuration Needed:**
- Fair Housing Act is federal law (applies uniformly to all states)
- Credit screening rules (FCRA) are federal (applies uniformly)
- These helpers teach terminology, not state-specific procedures
- State-specific screening guidance is provided via Compliance Cards, Templates, and Legal Updates

**Backend Implementation:**
- Server routes: `server/routes.ts` (POST `/api/explain-credit-term`, POST `/api/explain-criminal-eviction-term`)
- Both endpoints use OpenAI integration for AI explanations
- Rate limiter: 60 requests per 60 seconds per IP address (shared with chat)
- Privacy checks: Automatically reject SSNs, account numbers, and long numeric sequences

### Step 5: Update UI State Selectors (Frontend code)
Update the following files to include new state in dropdowns/tabs:
- **client/src/components/state-badge.tsx**: Add state code to `STATE_NAMES` object
- **client/src/pages/compliance.tsx**: 
  - Add state to TabsList grid (update grid-cols-5 to grid-cols-6, etc.)
  - Add TabsTrigger for new state
  - Add state to map array ["UT", "TX", "ND", "SD", "NC", "OH", ...]
- **client/src/pages/settings.tsx**: Add SelectItem for state in preferred state selector
- **client/src/pages/templates.tsx**: Add SelectItem for state in template filter
- **client/src/pages/properties.tsx**: Add state to US_STATES array

### Step 6: Restart Application
- Use `restart_workflow` on "Start application" workflow to reload server and hot-compile frontend changes

### Template-Compliance Alignment Requirement
**CRITICAL**: All template form fields must align with compliance card requirements. For example:
- If compliance card requires "lead-based paint disclosure for pre-1978 properties", template must have a checkbox field for this
- If compliance card requires "landlord/agent contact info", template must have form fields for landlord name, address, phone, email
- If compliance card requires specific notice periods (e.g., 30 days), template must include this in form field descriptions

### State Count
- **Current supported states**: 6 (UT, TX, ND, SD, NC, OH)
- **Expected per state**: 4 compliance cards, 7 templates, 2-3 legal updates