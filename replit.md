# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform ($15/month with 7-day free trial) providing small and midsize landlords with state-specific legal templates, compliance guidance, and tenant screening resources.

**Launch States**: Utah (UT), Texas (TX), North Dakota (ND), South Dakota (SD)

**Positioning**: "Protective mentor" tone throughout - helping landlords protect their investments while staying compliant.

## Technical Stack
- **Frontend**: React + TypeScript, TanStack Query, Wouter routing, Shadcn UI components
- **Backend**: Express.js, PostgreSQL (Neon), Drizzle ORM
- **Auth**: Replit Auth with session management
- **Payments**: Stripe Subscriptions with webhooks
- **Deployment**: Replit (auto-deploys on push)

## Project Structure
```
client/src/
├── pages/          # All application pages
│   ├── landing.tsx
│   ├── dashboard.tsx
│   ├── templates.tsx
│   ├── compliance.tsx
│   ├── screening.tsx
│   ├── tenant-issues.tsx
│   ├── settings.tsx
│   └── subscribe.tsx
├── components/ui/  # Shadcn components
└── lib/            # Utilities

server/
├── index.ts        # Express server setup
├── routes.ts       # API routes
├── replitAuth.ts   # Authentication
├── storage.ts      # Database storage layer
├── db.ts           # Drizzle database config
└── seed.ts         # Database seeding

shared/
└── schema.ts       # Shared TypeScript types + Drizzle schema
```

## Database Schema
- **users**: User accounts with subscription status, trial dates, Stripe IDs
- **states**: Launch states (UT, TX, ND, SD)
- **templates**: Legal document templates by state and category
- **complianceCards**: Before/after compliance guidance cards
- **legalUpdates**: State-specific legal updates with impact levels
- **userNotifications**: In-app notifications
- **analyticsEvents**: Usage tracking
- **screeningContent**: Tenant screening guides
- **tenantIssueWorkflows**: Issue resolution workflows
- **legislativeMonitoring**: Tracked bills from LegiScan with AI relevance analysis
- **templateReviewQueue**: Templates flagged for attorney review due to new legislation
- **templateVersions**: Version history for all template updates with change notes
- **monitoringRuns**: Log of each monthly legislative monitoring run
- **userNotifications**: Extended to support both legal update and template update notifications

## Setup Instructions

### 1. Environment Variables
The following secrets are required:

**Already Configured** (via Replit integrations):
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `STRIPE_SECRET_KEY` - Stripe test/live secret key
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key

**Required Setup**:
- `STRIPE_PRICE_ID` - **IMPORTANT**: Create this manually in Stripe dashboard
- `LEGISCAN_API_KEY` - **IMPORTANT**: Get free API key from legiscan.com for legislative monitoring

#### Setting up STRIPE_PRICE_ID

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Click "Create product"
3. Fill in:
   - **Name**: LeaseShield App Monthly Subscription
   - **Description**: Full access to state-specific templates and compliance updates
   - **Pricing**: $15.00 USD per month, recurring
4. Save the product
5. Copy the **Price ID** (starts with `price_`)
6. Add to Replit Secrets as `STRIPE_PRICE_ID`

#### Setting up LEGISCAN_API_KEY

1. Go to [LegiScan](https://legiscan.com/legiscan)
2. Click "Request API Key" (free tier)
3. Fill in account information
4. Verify email and activate account
5. Copy your API key
6. Add to Replit Secrets as `LEGISCAN_API_KEY`

**Free Tier:** 30,000 queries/month (plenty for 4 states)

### 2. Database Setup
```bash
# Push database schema
npm run db:push

# Seed initial data (4 states + sample content)
npx tsx server/seed.ts
```

### 3. Run Application
```bash
npm run dev
```
The app will be available on port 5000.

## Key Features

### Subscription Management
- 7-day free trial for new users
- $15/month recurring subscription
- Stripe Elements payment integration
- Webhook-driven subscription lifecycle
- Trial countdown timer on dashboard

### Template Library
- State-specific legal documents
- Categories: Leasing, Screening, Move In/Out, Notices, Evictions
- Attorney-reviewed templates
- Download as PDF/DOCX

### Compliance Cards
- Before/after comparison format
- State-specific compliance guidance
- "Why it matters" protective framing
- Actionable next steps

### Screening Toolkit
- Credit report decoder
- Background check guides
- Fair Housing compliance
- Western Verify integration CTAs

### Tenant Issue Workflows
- Step-by-step issue resolution
- State-specific procedures
- Document templates
- Timing requirements

## API Endpoints

### Authentication
- `GET /api/login` - Initiate Replit Auth
- `GET /api/callback` - Auth callback
- `GET /api/logout` - Sign out
- `GET /api/auth/user` - Get current user

### User
- `PATCH /api/user/settings` - Update preferences

### Subscriptions
- `POST /api/create-subscription` - Create Stripe subscription
- `POST /api/stripe-webhook` - Stripe webhook handler

### Templates
- `GET /api/templates` - List templates (with filters)
- `GET /api/templates/:id` - Get template
- `POST /api/admin/templates` - Create template (admin)

### Compliance
- `GET /api/compliance-cards?stateId=UT` - Get cards by state
- `POST /api/admin/compliance-cards` - Create card (admin)

### Legal Updates
- `GET /api/legal-updates?stateId=UT` - Get updates by state
- `GET /api/legal-updates/recent` - Get recent updates
- `POST /api/admin/legal-updates` - Create update (admin)
- `POST /api/admin/notify-legal-update/:updateId` - Send email notifications (admin)

### Legislative Monitoring (Internal/Automated)
- Monthly cron job runs automatically on 1st of each month
- Queries LegiScan API for new landlord-tenant bills
- AI analyzes relevance and flags affected templates
- Sends admin email with monthly report
- See LEGISLATIVE_MONITORING_SYSTEM.md for details

### Template Review & Publishing (Admin Only)
- `GET /api/admin/template-review-queue` - Get pending template reviews
- `PATCH /api/admin/template-review-queue/:id/approve` - Approve and publish template update
- `PATCH /api/admin/template-review-queue/:id/reject` - Reject template update
- `GET /api/templates/:id/versions` - Get template version history
- **Atomic Publishing**: All updates happen in a transaction (version increment, history record, queue status, user notifications)
- **User Notifications**: Automatic email + in-app notifications to all users in affected state

### Notifications
- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/unread-count` - Count unread
- `PATCH /api/notifications/:id/read` - Mark as read

### Analytics
- `POST /api/analytics/track` - Track event
- `GET /api/admin/analytics` - Get summary (admin)

### States
- `GET /api/states` - List active states

## Design System

### Colors
- **Primary**: Blue (#2563eb) - trust, professionalism
- **Secondary**: Slate gray (#475569) - stability, protection
- **Background**: Light gray (#f8fafc) in light mode
- **Accents**: Success green, warning yellow, error red

### Typography
- **Headings**: Space Grotesk (700 weight)
- **Body**: Inter (400/500/600 weights)
- **Professional, clean, readable**

### Component Patterns
- Cards with subtle shadows
- Before/after comparison layouts
- Badge-based categorization
- Icon-first navigation
- Protective mentor messaging

## Western Verify Integration
Strategic CTAs placed in:
- Screening toolkit page
- Credit report decoder section
- Background check guides

**Placement Strategy**: Natural mentions where landlords would actually need screening services, not pushy advertising.

## User Preferences
Users can set their preferred state (UT/TX/ND/SD) which:
- Filters templates by default
- Personalizes compliance cards
- Tailors legal updates
- Customizes dashboard content

## Trial & Subscription Logic
1. **New User Signup**: Automatically gets 7-day trial, `trialEndsAt` set
2. **Trial Active**: Full access, countdown timer shown
3. **Trial Ending**: Upgrade prompts at 3 days, 1 day remaining
4. **Post-Trial**: Access blocked, upgrade required
5. **Paid Subscription**: Full access, no trial messaging
6. **Payment Failed**: Marked as `past_due`, notified
7. **Canceled**: Access blocked, data retained 30 days

## Admin Features
- Create/edit templates
- Create/edit compliance cards
- Create/edit legal updates
- View analytics dashboard
- User management (future)

## Webhook Handling
Stripe webhooks update subscription status:
- `customer.subscription.created/updated` → Update status
- `customer.subscription.deleted` → Mark canceled
- `invoice.payment_succeeded` → Activate subscription
- `invoice.payment_failed` → Mark past_due

**Note**: Set `STRIPE_WEBHOOK_SECRET` in production for signature verification.

## Testing
- All auth flows: signup, login, logout
- Trial countdown and expiration
- Subscription creation with Stripe
- Template filtering and search
- State-specific content
- Compliance card interactions
- Webhook status updates

## Production Checklist
- [ ] Create production Stripe Price and set `STRIPE_PRICE_ID`
- [ ] Set `STRIPE_WEBHOOK_SECRET` from Stripe dashboard
- [ ] Configure Stripe webhook endpoint: `https://your-domain.com/api/stripe-webhook`
- [ ] Set up production database
- [ ] Run database migrations
- [ ] Seed production data
- [ ] Test payment flow end-to-end
- [ ] Monitor webhook delivery
- [ ] Set up error tracking (Sentry, etc.)

## Recent Changes
- **2024-11-20**: **Complete template update approval workflow implemented** - Full workflow from legislative detection to user notification
  - Transactional `publishTemplateUpdate()` storage method ensures atomic updates
  - Admin API endpoints for approving/rejecting template updates
  - Template version history tracking with immutable records
  - Automatic user notifications (email + in-app) when templates are updated
  - Extended userNotifications schema to support both legal updates and template updates
  - Version history API allows users to see all template changes over time
  - Human-in-the-loop approval maintains UPL compliance (attorney must approve all changes)
  - See TEMPLATE_UPDATE_WORKFLOW.md for complete documentation
- **2024-11-20**: **Automated legislative monitoring system implemented** - Monthly monitoring for new landlord-tenant laws
  - LegiScan API integration (30k free queries/month) for tracking state legislation in UT/TX/ND/SD
  - Monthly cron job (runs 1st of each month) searches for relevant bills
  - AI-powered relevance analysis using GPT-4 to identify bills affecting templates
  - Automated template review queue with priority-based flagging
  - Email notification system sends monthly admin reports with findings
  - Semi-automated workflow maintains UPL compliance (human approval required before publishing changes)
  - Database tables: legislativeMonitoring, templateReviewQueue, monitoringRuns
  - Comprehensive documentation in LEGISLATIVE_MONITORING_SYSTEM.md
  - Monthly cost: ~$2-5 (OpenAI API usage for bill analysis)
- **2024-11-19**: **Email notification system implemented** - Legal update emails with Resend integration
  - Professional HTML/text email templates for high/medium/low impact legal updates
  - Impact-based routing (high → all active/trialing users, medium → state-specific users)
  - API endpoint: `POST /api/admin/notify-legal-update/:updateId`
  - In-app notification creation alongside email delivery
  - Comprehensive documentation in LEGAL_UPDATE_SYSTEM.md
  - support@leaseshieldapp.com as sender address
- **2024-11-19**: Added Western Verify LLC referral disclosure to Terms of Service and Legal Disclaimers
- **2024-11-19**: Created comprehensive legal pages (Terms, Refund Policy, Disclaimers)
- **2024-11-19**: Added UPL compliance disclaimer banners to Templates, Compliance, Screening, and Tenant Issues pages
- **2024-11-19**: Updated footer with all legal page links
- **2024-11-19**: Added Account Access FAQ to Help Center explaining Replit Auth
- **2024-11-18**: Backend implementation complete with Stripe integration
- **2024-11-18**: Database schema pushed and seeded
- **2024-11-18**: All API routes implemented
- **2024-11-18**: Stripe webhook handler with signature verification
- **2024-11-18**: Fixed subscription to use stable Price ID instead of ad-hoc prices

## Known Limitations
- Admin features require manual role assignment (no UI yet)
- Western Verify integration is CTA-based, no API integration
- No automated testing suite yet
- Legislative monitoring runs automatically but requires admin dashboard for template review workflow
- Template review queue requires manual admin review (no UI yet)

## Future Enhancements
- Admin role management UI
- Automated legislative tracking API integration
- More launch states
- Template versioning
- Document assembly wizard
- Property management features
- Lease signing integration
- SMS alerts for urgent legal updates (Twilio)
