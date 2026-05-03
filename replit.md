# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform for small and midsize landlords, supporting 16 US states. It provides state-specific legal templates, compliance guidance, and tenant screening resources to protect landlord investments and ensure legal compliance. The project aims to be the go-to solution for landlords navigating legal complexities, offering clear, actionable advice and tools.

## User Preferences
- No free trial language: Users are either "Active" (subscribed) or "Inactive" (not subscribed)
- Monthly billing default: Subscribe page defaults to monthly ($10/month), annual framed as "Includes 2 months free"
- Core brand sentence: "Most landlords only face these decisions a few times per year. LeaseShield is there when they do."

## System Architecture

### UI/UX Decisions
The platform uses a teal/turquoise primary color (#2DD4BF) with navy blue text, matching the LeaseShield logo branding. Typography is Space Grotesk for headings and Inter for body text. UI patterns include cards with shadows, before/after comparisons, badge-based categorization, and icon-first navigation, all maintaining a "protective mentor" tone.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter, Shadcn UI.
- **Backend**: Express.js, PostgreSQL (Neon), Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions with webhooks.
- **Document Generation Architecture**: Supports server-side PDF generation using Puppeteer for LeaseShield-formatted documents and `pdf-lib` for official court forms (Official PDF Overlay mode). It includes a generic field map architecture for dynamic form filling and shared utilities for DOCX generation using the native `docx` library. Routing is deterministic via `templates.output_template_id`.
- **Legislative Monitoring**: A safe, approval-gated two-job architecture ingests and normalizes legislative updates, queuing them for admin approval.
- **Template Review & Publishing**: Features an approval-gated system with transactional updates, versioning, history tracking, and admin review queues.
- **AI Screening Helpers**: GPT-4o-mini powered tools for credit report and criminal/eviction screening, emphasizing Fair Housing compliance. Includes optional batch decode mode that splits a list of findings (one per line / numbered) into individual decode calls (concurrency=3) and renders a triaged accordion sorted high → medium → low caution. Follow-up questions returned by the AI are promoted into an "Ask the Applicant" checklist with a copy-to-clipboard button. State-aware quick-start chips appear when the user has a preferred state set, drawn from a curated `STATE_AWARE_CHIPS` map (no AI-generated state law).
- **State Notes Safety System**: Ensures zero AI-generated state law content in decoders by injecting state notes from a versioned and approved database.
- **AI Chat Assistant**: Integrated GPT-4o-mini chat widget for instant help.
- **Multi-Property Management**: CRUD operations for properties, document association, and filtering.
- **Rent Collection**: Includes recurring auto-pay (NACHA-compliant monthly ACH auto-debit) and a mandatory tenant-paid service fee. The rent page is restructured into "Requests / History / Recurring / Export" tabs.
- **Document Upload/Re-Upload System**: Securely handles user document uploads and provides token-based links for re-uploads.
- **Auto-Default Applicant Link Per Property**: Automatically generates a shareable applicant link for every property, with per-link analytics, QR code download, pause/resume functionality, and slug auto-suggest.
- **Landlord Email on New Application**: Sends email notifications to landlords upon new application submission.
- **Per-Unit Security Deposit Override**: Allows individual rental units to override the property-level security deposit.
- **Compliance Toolkit**: Interactive cards displaying state-specific legal requirements.
- **SEO Infrastructure**: Includes server-generated `/sitemap.xml` and a lightweight `<SEO>` component for dynamic meta-tag updates.
- **Marketing Enhancements**: Landing page prominently surfaces rent collection features, including online rent collection, ACH, and recurring auto-pay.
- **State-by-State Landlord Blog**: SEO-optimized articles across supported states covering key landlord topics, with inline CTAs.

### Feature Specifications
- **Subscription Management**: Integrated with Stripe.
- **Template Library**: State-specific legal documents with form fields and statute references.
- **Compliance Cards**: Detailed state-specific guidance.
- **Screening Toolkit**: Guides for credit reports, background checks, and Fair Housing.
- **Tenant Issue Workflows**: Step-by-step resolution guides.
- **User Preferences**: Allows setting a preferred state for personalized content.
- **Admin Interfaces**: For legislative monitoring and resource management.

### System Design Choices
- **Deployment**: Automated deployments via Replit.
- **Database Schema**: Comprehensive schema with unique constraints and canonical keys for idempotent upserts.
- **API Endpoints**: Structured API for core functionalities.
- **Template Alignment**: Templates align with compliance card requirements.
- **State Registry Architecture**: Database-driven with caching, an API endpoint, and scripts for verification.

## External Dependencies
- **PostgreSQL (Neon)**: Relational database.
- **Stripe**: Payment gateway.
- **Replit Auth**: User authentication.
- **Legislative Source APIs**: LegiScan, Plural Policy, Utah GLEN, Federal Register, eCFR, Congress.gov, HUD ONAP/PIH, CourtListener.
- **GPT-4o-mini (OpenAI API via Replit AI Integration)**: AI analysis and chat.
- **Puppeteer**: Server-side PDF generation.
- **Western Verify LLC**: Tenant screening services (via CTAs).
- **Resend**: Email notifications.