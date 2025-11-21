# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform ($12/month with 7-day free trial) designed for small and midsize landlords. Its primary purpose is to provide state-specific legal templates, compliance guidance, and tenant screening resources. The platform aims to be a "protective mentor," helping landlords safeguard their investments while ensuring compliance with legal regulations. Initial launch states include Utah, Texas, North Dakota, and South Dakota.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
- **Color Scheme**: Primary blue (#2563eb) for trust, secondary slate gray (#475569) for stability, light gray background (#f8fafc).
- **Typography**: Space Grotesk (headings), Inter (body) for a professional and readable aesthetic.
- **Component Patterns**: Utilizes cards with subtle shadows, before/after comparison layouts, badge-based categorization, and icon-first navigation.
- **Messaging**: "Protective mentor" tone integrated throughout the user experience.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter for routing, and Shadcn UI components.
- **Backend**: Express.js server, PostgreSQL (via Neon) database, Drizzle ORM.
- **Authentication**: Replit Auth with session management.
- **Payments**: Stripe Subscriptions for payment processing, integrated with webhooks for subscription lifecycle management.
- **Document Assembly Wizard**: Interactive multi-step forms with smart field validation, real-time validation, server-side PDF generation using Puppeteer, and comprehensive HTML escaping for security. PDFs feature professional attorney-quality styling including: professional letterhead header ("LEASESHIELD LEGAL DOCUMENTS"), Times New Roman typography with 1.8 line-height, enhanced 1-inch margins, formal signature blocks with bordered sections and "IN WITNESS WHEREOF" legal language, version info display, and comprehensive professional formatting that makes all documents appear as attorney-prepared legal documents.
- **Legislative Monitoring**: Fully automated end-to-end system with monthly cron job integration via LegiScan API. Workflow: (1) LegiScan monitors state bills for UT, TX, ND, SD → (2) AI analyzes bills using GPT-4 to determine relevance and affected templates → (3) Auto-publishes template updates with versioning → (4) Users notified immediately via email → (5) Admin can review history optionally. Includes manual trigger button for testing. Protected cron endpoint (`/api/cron/legislative-monitoring`) with secret key verification.
- **Template Review & Publishing**: Atomic auto-publishing system ensures template updates are transactional. Includes: versioning with auto-incrementing version numbers, complete history tracking, automatic approval and publishing, legislative bill flagging, and immediate user notifications via Resend. Updates are published automatically when AI detects relevant legislation, with full audit trail available to admin.
- **Email Notifications**: Integration with a professional email service (e.g., Resend) for legal update and template update notifications.

### Feature Specifications
- **Subscription Management**: 7-day free trial, $12/month subscription, Stripe Elements integration, webhook-driven lifecycle, and trial countdowns.
- **Template Library**: State-specific legal documents categorized by use case and downloadable as PDF/DOCX.
- **Compliance Cards**: State-specific before/after guidance with explanations and actionable next steps.
- **Screening Toolkit**: Guides for credit reports, background checks, Fair Housing compliance, and CTAs for Western Verify integration.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and document templates.
- **User Preferences**: Users can set their preferred state to filter content and personalize their experience.

### System Design Choices
- **Deployment**: Automated deployments via Replit on push.
- **Database Schema**: Comprehensive schema including users, states, templates, compliance cards, legal updates, analytics, screening content, tenant issue workflows, legislative monitoring data, and notifications.
- **API Endpoints**: Structured API for authentication, user management, subscriptions, templates, compliance, legal updates, legislative monitoring (admin-only: bills list, review queue, approve/reject, manual trigger), template review (versioning & publishing), notifications, analytics, and states. Cron endpoint for scheduled monitoring runs.
- **Admin Legislative Monitoring UI**: Dedicated admin page (`/admin/legislative-monitoring`) with three tabs: (1) Published Updates - shows auto-published template updates with bill context and recommended changes for audit trail, (2) Pending Bills - displays unreviewed bills with AI analysis and affected templates, (3) History - tracks all published updates and reviewed bills. Includes manual "Run Monitoring Now" button for testing. All template updates are automatically published without requiring manual approval.
- **Admin Resource Management**: All admin management pages (Templates, Compliance Cards, Legal Updates) now have complete CRUD operations with edit and delete functionality, allowing admins to manage all platform content directly through the UI.

## External Dependencies
- **PostgreSQL (Neon)**: Relational database for all application data.
- **Stripe**: Payment gateway for subscription management, including Stripe Elements for UI and webhooks for server-side updates.
- **Replit Auth**: Authentication service for user login and session management.
- **LegiScan API**: Third-party service for legislative tracking and monitoring. Requires LEGISCAN_API_KEY environment variable.
- **GPT-4 (OpenAI API via Replit AI Integration)**: Used for AI-powered relevance analysis of legislative bills. Uses AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL environment variables.
- **Puppeteer**: Used for server-side PDF generation from HTML templates.
- **Western Verify LLC**: Integrated via Call-To-Actions (CTAs) within the screening toolkit for tenant screening services.
- **Resend**: Email service for sending user notifications.

## Automated Monthly Legislative Monitoring Setup

### Using Replit Scheduled Deployments (Recommended)
1. **Set Environment Variables:**
   - Add `CRON_SECRET` to your Repl secrets (a secure random string)
   - The `REPLIT_DOMAINS` variable is automatically set by Replit

2. **Create Scheduled Deployment:**
   - Click the "Publish" button in your Replit workspace
   - Select "Scheduled" deployment type
   - Configure the schedule:
     - **Schedule:** `0 2 1 * *` (2:00 AM UTC on the 1st of every month)
     - **Run command:** `tsx cron-legislative-monitoring.ts`
     - **Timeout:** 5 minutes (should complete in under 2 minutes typically)
   - Click "Deploy"

3. **Verify Setup:**
   - The scheduled deployment will run monthly automatically
   - Check the deployment logs in the "Publish" panel to see execution results
   - Alternatively, use admin UI "Run Monitoring Now" button for manual triggers anytime

### Alternative: External Cron Service
If not using Replit's scheduled deployments:
1. Set `CRON_SECRET` environment variable to a secure random string
2. Configure external cron service (e.g., cron-job.org, EasyCron) to POST to: `https://your-domain.com/api/cron/legislative-monitoring`
3. Add header: `X-Cron-Secret: <your-cron-secret>`
4. Schedule: Monthly (recommended: 1st of each month at 2:00 AM UTC)
```