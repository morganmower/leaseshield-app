# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform for small and midsize landlords, currently supporting 16 US states. It provides state-specific legal templates, compliance guidance, and tenant screening resources to protect landlord investments and ensure legal compliance. The project aims to be the go-to solution for landlords navigating legal complexities, offering clear, actionable advice and tools.

## User Preferences
- No free trial language: Users are either "Active" (subscribed) or "Inactive" (not subscribed)
- Monthly billing default: Subscribe page defaults to monthly ($10/month), annual framed as "Includes 2 months free"
- Core brand sentence: "Most landlords only face these decisions a few times per year. LeaseShield is there when they do."

## System Architecture

### UI/UX Decisions
The platform uses a teal/turquoise primary color (#2DD4BF) with navy blue text, matching the LeaseShield logo branding. Typography is Space Grotesk for headings and Inter for body text. UI patterns include cards with shadows, before/after comparisons, badge-based categorization, and icon-first navigation, all maintaining a "protective mentor" tone. Logo files are managed with specific sizing and cache-busting considerations.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter, Shadcn UI.
- **Backend**: Express.js, PostgreSQL (Neon), Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions with webhooks.
- **Document Generation Architecture**: A robust system supporting server-side PDF generation using Puppeteer for LeaseShield-formatted documents and `pdf-lib` for official court forms (Official PDF Overlay mode). It includes a generic field map architecture for dynamic form filling and shared utilities for DOCX generation using the native `docx` library. Routing is deterministic via `templates.output_template_id` — zero state-code or title-matching heuristics. Field maps live in `output_templates.field_map_json` (DB-driven, no in-code constants for new forms).
  - **Implemented Official PDF Overlay Forms** (mandatory flatten, zero LeaseShield branding):
    - MI SCAO DC 100a — Demand for Possession: `form_fields` strategy, 13/13 smoke test assertions passing
    - MI SCAO DC 100c — Complaint Land Contract Forfeiture: `form_fields` strategy, AcroForm fields, 2 pages, 15/15 smoke test assertions passing
    - SD UJS-112 — Verified Complaint for Eviction: `coordinates` strategy, 12 overlay_fields, 4 pages, 6/6 smoke test passing
    - UT 1100EVJ — Complaint for Unlawful Detainer: `coordinates` strategy, 16 overlay_fields, 9 pages, 6/6 smoke test passing
    - ID CAO UD 1-1 — Complaint for Eviction Expedited Proceeding: `form_fields` strategy, 25 AcroForm fields, 2 pages, 15/15 smoke test assertions passing; source: courtselfhelp.idaho.gov
  - **Blocked (no statewide public PDF)**: OH (county-level only — each county has its own form); remains `leaseshield_formatted`
- **Legislative Monitoring**: A safe, approval-gated two-job architecture ingests and normalizes legislative updates from multiple sources, queuing them for admin approval before publishing. It uses a job lock to prevent overlapping runs and topic-based routing for relevance.
- **Template Review & Publishing**: Features an approval-gated system with transactional updates, versioning, history tracking, and admin review queues.
- **AI Screening Helpers**: GPT-4o-mini powered tools for credit report and criminal/eviction screening, emphasizing Fair Housing compliance.
- **State Notes Safety System**: Ensures zero AI-generated state law content in decoders by injecting state notes from a versioned and approved database, with strict fallback logic and prompt guardrails.
- **AI Chat Assistant**: Integrated GPT-4o-mini chat widget for instant help.
- **Multi-Property Management**: CRUD operations for properties, document association, and filtering.
- **Sidebar Naming**: Authenticated sidebar uses outcome-oriented labels — "Document Templates" (state-specific notices/leases), "Document Library" (uploaded user docs), "Application Inbox" (received rental submissions), and **"Rent"** (renamed from "Rent Ledger" — the `/rent-ledger` URL is preserved for back-compat). Industry research confirmed no major competitor (Avail, RentRedi, Baselane, TurboTenant, Hemlane, Stessa) uses "Ledger" as a top-level nav; ledger is always a sub-view.
- **Recurring Auto-Pay (Plan B)**: NACHA-compliant monthly ACH auto-debit. Architecture: Stripe Checkout `mode:'setup'` saves a `us_bank_account` PaymentMethod on the platform, then a nightly cron (`processRecurringRentDebits`) creates off-session PaymentIntents with `transfer_data.destination` to the landlord's Connect account. Schema: `rent_subscriptions` table with partial unique index `WHERE status='active'`, FK on `rent_payment_requests.rent_subscription_id`. Webhooks: `setup_intent.succeeded` activates + snapshots mandate, `payment_method.detached` + `mandate.updated` mark `revoked_by_tenant`. Tenant self-cancel at `/auto-pay/:token` (detaches PM in Stripe). Landlord CRUD in Rent → Recurring tab. Cron dedupes via `(rentSubscriptionId, dueDate)` lookup; advances `nextScheduledDate` by one calendar month (clamped to day 1-28).
- **Rent Service Fee (Mandatory Tenant-Paid)**: Every online rent payment carries a tenant-paid convenience fee — landlords cannot opt out or shift the fee to themselves (would put LeaseShield in the red on Stripe ACH's 0.8%/$5-cap fee against our $1.50 platform margin). `server/rentFees.ts` exports `MIN_SERVICE_FEE_CENTS=350` ($3.50 floor, leaves margin over worst-case Stripe ACH) and `DEFAULT_SERVICE_FEE_CENTS=495` ($4.95 default, matches industry norms — Avail $2.50, TurboTenant $2.99, RentRedi $2). `POST /api/rent-payments` and `PATCH /api/rent-payments/:id` always force `serviceFeePayer='tenant'` and reject amounts below MIN. `GET/PATCH /api/rent-payments/fee-settings` always returns/persists `defaultServiceFeeEnabled: true` (legacy clients ignored). The Rent → Payment Fees card is amount-only — no enable checkbox, no payer dropdown in create/edit dialogs. Legacy rows with `serviceFeePayer='landlord'/'none'` still display correctly in history/receipts but cannot be edited back into that state.
- **Rent Page Tabs**: Restructured to **Requests / History / Recurring / Export** with Requests as the default tab. The Requests tab supports landlord **edit of unpaid payment requests** via `PATCH /api/rent-payments/:id` with full partial-input validation (returns 400 on bad numerics/dates). Edits are blocked once status is `paid` or `processing`; if amount or due date changes, any open Stripe Checkout session is expired (mirroring the DELETE pattern) and a fresh session is created lazily on the tenant's next click — the original `publicToken` payment link continues to work.
- **Document Upload/Re-Upload System**: Securely handles user document uploads (PDF, DOC, DOCX) and provides token-based links for applicants to re-upload missing documents.
- **Compliance Toolkit**: Interactive cards displaying state-specific legal requirements.
- **SEO Infrastructure**: Static `client/public/robots.txt` served at `/robots.txt`. **`/sitemap.xml` is server-generated** by an Express route in `server/routes.ts` (registered before vite/static so the dynamic version is the single source of truth — the legacy static `client/public/sitemap.xml` has been removed). The route lists static marketing URLs plus every published blog post (with `<lastmod>` from `updatedAt`/`publishedAt`), XML-escaped, served as `application/xml` with a 1-hour cache header. Lightweight `<SEO>` component (`client/src/components/seo.tsx`) updates document head per page (title, description, canonical, og/twitter tags) — always writes every tag with sensible defaults so navigation never leaves stale meta values. Wired into landing, subscribe, blog, blog-post, screening-explain, templates, login, signup, compliance, legal-updates.
- **Landing Trust Bar**: Honest 4-stat strip below the hero CTA on `client/src/pages/landing.tsx` (between reassurance copy and Dashboard Preview): "16 states covered today", "Official forms — court-issued PDFs", "AI screening — Fair Housing aware", "30-day money-back guarantee". Uses lucide icons (`MapPin`, `Scale`, `Sparkles`, `ShieldCheck`) already in scope, semantic `bg-card/60` + `border-border/60` tokens, `data-testid="section-trust-bar"`. No fake testimonials/usage stats.
- **Marketing — Rent Collection Surface**: Public landing page (`client/src/pages/landing.tsx`) surfaces the new rent features in three places: (1) SEO `<title>` and meta description mention "online rent collection (ACH + recurring auto-pay)"; (2) the dashboard preview module grid includes an "Online Rent Collection" card tagged "New"; (3) the "Rent Ledger" feature card is renamed "Rent Collection & Ledger" with bullets for ACH links, NACHA-compliant monthly auto-pay, and ledger/late-fee tracking; (4) a dedicated spotlight section ("Get Rent Paid On Time, Automatically") with three sub-cards — One-Click Payment Links, Recurring Auto-Pay (badged New), and Automatic Ledger — plus a "Powered by Stripe Connect · NACHA-compliant ACH" footnote. All copy is honest (no usage stats); icons added: `Banknote`, `Repeat` from lucide-react.
- **State-by-State Landlord Blog**: 64+ SEO-optimized articles seeded across all 16 supported states via `server/seedStateBlogPosts.ts` (idempotent — uses `ON CONFLICT (slug) DO NOTHING`). Each state has 4 high-intent guides covering eviction, security deposits, lease requirements, and tenant screening. Every post sets `metaTitle`, `metaDescription`, `slug`, `featuredImageUrl`, `stateIds`, `tags`, and `isPublished`, and includes an inline CTA linking to the relevant `/templates/{id}` and a closing CTA to `/subscribe`. Articles auto-appear in `/sitemap.xml` and on `/blog`.

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