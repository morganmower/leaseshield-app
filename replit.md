# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform for small and midsize landlords. It provides state-specific legal templates, compliance guidance, and tenant screening resources to protect investments and ensure legal compliance. The platform currently supports 14 states (UT, TX, ND, SD, NC, OH, MI, ID, WY, CA, VA, NV, AZ, FL).

## Project Documentation

### Key Documentation Files
- **[README.md](./README.md)** — Business plan, mission statement, monetization strategy, competitive positioning, and feature overview. This is the foundational document explaining the project's purpose and goals.
- **[progress.md](./progress.md)** — Detailed feature implementation checklist with checkbox tracking. Shows completed vs. pending features, organized by category. Use this to track development progress and identify remaining work.
- **[replit.md](./replit.md)** (this file) — Technical architecture, system design decisions, and AI agent context. Maintains session memory and project state.

### Documentation Purposes
| File | Purpose | When to Update |
|------|---------|----------------|
| README.md | Business context, goals, monetization | Major feature additions, business pivots |
| progress.md | Feature tracking, implementation status | After completing features, sprint planning |
| replit.md | Technical architecture, AI context | Architecture changes, new integrations |

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
The platform uses a teal/turquoise primary color (#2DD4BF) with navy blue text, matching the LeaseShield logo branding. Typography is Space Grotesk for headings and Inter for body text. UI patterns include cards with shadows, before/after comparisons, badge-based categorization, and icon-first navigation, all maintaining a "protective mentor" tone.

### Logo & Branding
- **Primary Icon**: `client/src/assets/leaseshield-icon-v3.png` - House-shield-keyhole logo with transparent background. This is the master icon used on the dashboard and for favicon generation.
- **Logo Files**: Horizontal logo at `client/src/assets/logo-horizontal.png`, stacked logo at `client/src/assets/logo-stacked.png`
- **Logo Sizes**: sm (h-8), md (h-12), lg (h-16), xl (h-32) for horizontal variant
- **Primary Color**: Teal/turquoise (HSL 168 76% 42%)
- **Text Color**: Navy blue (HSL 215 35% 20%)
- **Cache-busting**: Favicon/icon URLs use `?v=7` query parameter. Increment when assets change.
- **CRITICAL - Vite Asset Caching**: When updating logo PNG files, always use a NEW filename (e.g., v2, v3) to force Vite to generate a new hash. Editing an existing file in-place will NOT update the cached asset.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter, Shadcn UI.
- **Backend**: Express.js, PostgreSQL (Neon), Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions with webhooks.
- **Document Assembly Wizard**: Interactive multi-step forms, server-side PDF generation (Puppeteer) with professional styling, and robust HTML escaping.
- **Document Generation Architecture**: 
  - **PDF** (Puppeteer): Used for delivery, legal filings, and court submissions. HTML-to-PDF ensures pixel-perfect rendering.
  - **DOCX** (native `docx` library): Used for editable customer documents. NEVER use html-to-docx (caused Word corruption). Guard comments in all generators prevent regression.
  - **Shared utilities**: `docxBuilder.ts` provides reusable components (H1, H2, H3, P, SignatureLine, HR, Footer, Tables) and `getStateDisclosures()` for state-specific legal provisions.
  - **State-specific content**: All 14 states have comprehensive disclosures in Section 25 of lease documents (security deposits, entry notice, fair housing, mold/radon/bed bugs as applicable).
- **Legislative Monitoring**: Normalized source adapter architecture with 8 data sources:
  - **State Sources**: LegiScan API, Plural Policy/Open States API, Utah GLEN API (UT-specific)
  - **Federal Sources**: Federal Register API (HUD), eCFR API (24 CFR Part 1000), Congress.gov API
  - **Court/Notice Sources**: CourtListener API, HUD ONAP/PIH page poller
  - **Topic-Based Routing**: Updates tagged with topics (landlord_tenant, nahasda_core, ihbg, etc.) route only to relevant templates
  - **Tribal Housing Support**: Separate `runTribalMonitoring()` pipeline isolates NAHASDA/IHBG updates from landlord-tenant content
  - **Pipeline Modes**: `runLandlordTenantMonitoring()` for 14-state landlord content, `runTribalMonitoring()` for tribal housing authorities
  - Uses GPT-4 for relevance analysis, auto-publishes updates with versioning and notifications
- **Template Review & Publishing**: Atomic auto-publishing system with transactional updates, versioning, history tracking, automatic approval, legislative bill flagging, and user notifications via Resend.
- **Email Notifications**: Integrated with Resend for legal and template update notifications.
- **AI Screening Helpers**: GPT-4o-mini powered tools for credit report and criminal/eviction screening, emphasizing Fair Housing compliance, with "Learn" and "Ask" modes and privacy features.
- **AI Chat Assistant**: Integrated GPT-4o-mini chat widget (OpenAI) for instant help on landlord-tenant law and platform features.
- **Multi-Property Management**: CRUD operations for properties, document association, and filtering.
- **Document Upload System**: Securely handles user uploads (PDF, DOC, DOCX up to 20MB) with custom naming and optional property association.
- **Compliance Toolkit**: Interactive cards displaying state-specific legal requirements, statute citations, key requirements, and actionable steps.

### Feature Specifications
- **Subscription Management**: 7-day free trial, $10/month subscription via Stripe.
- **Template Library**: State-specific legal documents (PDF/DOCX) categorized by use case, including form fields and state statute references.
- **Compliance Cards**: Detailed state-specific guidance with legal authority, key requirements, and actionable steps.
- **Screening Toolkit**: Guides for credit reports, background checks, and Fair Housing, with CTAs for Western Verify integration and AI helpers.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and document templates.
- **User Preferences**: Allows users to set a preferred state for personalized content.
- **Admin Interfaces**: Legislative monitoring UI and resource management (CRUD for Templates, Compliance Cards, Legal Updates).

### System Design Choices
- **Deployment**: Automated deployments via Replit.
- **Database Schema**: Comprehensive schema for users, states, templates, compliance cards, legal updates, analytics, screening content, tenant issue workflows, legislative monitoring data, notifications, properties, savedDocuments, and uploadedDocuments.
- **API Endpoints**: Structured API for all core functionalities.
- **Template Alignment**: Templates include form fields and legal text that align with all compliance card requirements for each state.

## External Dependencies
- **PostgreSQL (Neon)**: Relational database.
- **Stripe**: Payment gateway.
- **Replit Auth**: User authentication.
- **Legislative Source APIs (8 total)**:
  - **LegiScan API**: State bill tracking (14 states)
  - **Plural Policy API (Open States v3)**: Additional bill coverage (rate limited: 1 req/sec, 500 daily)
  - **Utah GLEN API**: Utah-specific state legislation
  - **Federal Register API**: HUD regulations via Data.gov
  - **eCFR API**: Code of Federal Regulations changes (24 CFR Part 1000 for NAHASDA)
  - **Congress.gov API**: Federal housing bills (optional, requires API key)
  - **HUD ONAP/PIH Notices**: Page polling for tribal housing notices
  - **CourtListener API**: Court case and legal precedent tracking
- **GPT-4 (OpenAI API via Replit AI Integration)**: AI analysis.
- **Puppeteer**: Server-side PDF generation.
- **Western Verify LLC**: Tenant screening services (via CTAs).
- **Resend**: Email notifications.