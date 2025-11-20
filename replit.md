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
- **Document Assembly Wizard**: Interactive multi-step forms with smart field validation, real-time validation, server-side PDF generation using Puppeteer, and comprehensive HTML escaping for security.
- **Legislative Monitoring**: Fully automated system with monthly cron job integration via LegiScan API. Workflow: (1) LegiScan monitors state bills for UT, TX, ND, SD → (2) AI analyzes bills using GPT-4 to determine relevance and affected templates → (3) Creates template review queue entries → (4) Admin reviews/approves in dedicated UI → (5) Approved updates auto-publish with versioning → (6) Users notified via email. Includes manual trigger button for testing and admin oversight. Protected cron endpoint (`/api/cron/legislative-monitoring`) with secret key verification.
- **Template Review & Publishing**: Atomic publishing system ensures template updates are transactional. Includes: versioning with auto-incrementing version numbers, complete history tracking, review queue status updates (pending → approved/rejected), legislative bill flagging as reviewed, and automatic user notifications via Resend. Manual admin review process ensures UPL compliance before any template goes live.
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
- **Admin Legislative Monitoring UI**: Dedicated admin page (`/admin/legislative-monitoring`) with three tabs: (1) Template Review Queue - shows pending template updates with bill context, recommended changes, approve/reject actions, (2) Pending Bills - displays unreviewed bills with AI analysis and affected templates, (3) History - tracks approved reviews and reviewed bills. Includes manual "Run Monitoring Now" button for testing.

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