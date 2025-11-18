# LeaseShield Pro - SaaS Platform for Landlords

## Overview
LeaseShield Pro is a subscription-based SaaS platform ($15/month with 7-day free trial) providing small and midsize landlords with state-specific legal templates, compliance guidance, and tenant screening resources.

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

#### Setting up STRIPE_PRICE_ID

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Click "Create product"
3. Fill in:
   - **Name**: LeaseShield Pro Monthly Subscription
   - **Description**: Full access to state-specific templates and compliance updates
   - **Pricing**: $15.00 USD per month, recurring
4. Save the product
5. Copy the **Price ID** (starts with `price_`)
6. Add to Replit Secrets as `STRIPE_PRICE_ID`

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
- **2024-11-18**: Backend implementation complete with Stripe integration
- **2024-11-18**: Database schema pushed and seeded
- **2024-11-18**: All API routes implemented
- **2024-11-18**: Stripe webhook handler with signature verification
- **2024-11-18**: Fixed subscription to use stable Price ID instead of ad-hoc prices

## Known Limitations
- Admin features require manual role assignment (no UI yet)
- Email notifications not implemented (placeholder hooks ready)
- Western Verify integration is CTA-based, no API integration
- No automated testing suite yet

## Future Enhancements
- Email notification system
- Admin role management UI
- More launch states
- Template versioning
- Document assembly wizard
- Property management features
- Lease signing integration
