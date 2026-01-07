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
- **Primary Icon**: `client/src/assets/leaseshield-icon.png` - House-and-key logo with 15% transparent padding on all sides. This is the master icon that should be used everywhere.
- **Logo Files**: Horizontal logo at `client/src/assets/logo-horizontal.png`, stacked logo at `client/src/assets/logo-stacked.png`
- **Logo Sizes**: sm (h-8), md (h-12), lg (h-16), xl (h-32) for horizontal variant
- **Primary Color**: Teal/turquoise (HSL 168 76% 42%)
- **Text Color**: Navy blue (HSL 215 35% 20%)
- **CRITICAL - Logo Padding**: All icon/logo images MUST have ~15% transparent padding around the artwork. Without padding, logos appear "cut off" when displayed in contexts with rounded corners (favicons, touch icons) or constrained sizes. The master icon at `leaseshield-icon.png` has proper padding built in.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter, Shadcn UI.
- **Backend**: Express.js, PostgreSQL (Neon), Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions with webhooks.
- **Document Assembly Wizard**: Interactive multi-step forms, server-side PDF generation (Puppeteer) with professional styling, and robust HTML escaping.
- **Legislative Monitoring**: Automated system using four data sources (LegiScan API, Plural Policy/Open States API, Federal Register API, CourtListener API) tracks state bills, federal HUD regulations, and court cases, uses GPT-4 for relevance analysis, and auto-publishes template updates with versioning and user notifications. Bills display color-coded source badges in admin UI (green=LegiScan, blue=Plural Policy, purple=Federal Register).
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
- **LegiScan API**: Legislative tracking.
- **Plural Policy API (Open States v3)**: Additional legislative bill coverage with rate limiting (1 req/sec, 500 daily requests).
- **Federal Register API**: Federal HUD housing regulations and rulemaking tracking via Data.gov.
- **CourtListener API**: Court case and legal precedent tracking.
- **GPT-4 (OpenAI API via Replit AI Integration)**: AI analysis.
- **Puppeteer**: Server-side PDF generation.
- **Western Verify LLC**: Tenant screening services (via CTAs).
- **Resend**: Email notifications.