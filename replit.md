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
- **Legislative Monitoring**: Monthly cron job integrates with LegiScan API to track landlord-tenant bills, uses AI (GPT-4) for relevance analysis, and flags affected templates for review.
- **Template Review & Publishing**: An atomic publishing system ensures template updates are transactional, including versioning, history records, queue status updates, and automatic user notifications. A manual admin review process ensures UPL compliance.
- **Email Notifications**: Integration with a professional email service (e.g., Resend) for legal update and template update notifications.

### Feature Specifications
- **Subscription Management**: 7-day free trial, $12/month subscription, Stripe Elements integration, webhook-driven lifecycle, and trial countdowns.
- **Template Library**: State-specific legal documents categorized by use case, attorney-reviewed, and downloadable as PDF/DOCX.
- **Compliance Cards**: State-specific before/after guidance with explanations and actionable next steps.
- **Screening Toolkit**: Guides for credit reports, background checks, Fair Housing compliance, and CTAs for Western Verify integration.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and document templates.
- **User Preferences**: Users can set their preferred state to filter content and personalize their experience.

### System Design Choices
- **Deployment**: Automated deployments via Replit on push.
- **Database Schema**: Comprehensive schema including users, states, templates, compliance cards, legal updates, analytics, screening content, tenant issue workflows, legislative monitoring data, and notifications.
- **API Endpoints**: Structured API for authentication, user management, subscriptions, templates, compliance, legal updates, legislative monitoring (internal), template review, notifications, analytics, and states.

## External Dependencies
- **PostgreSQL (Neon)**: Relational database for all application data.
- **Stripe**: Payment gateway for subscription management, including Stripe Elements for UI and webhooks for server-side updates.
- **Replit Auth**: Authentication service for user login and session management.
- **LegiScan API**: Third-party service for legislative tracking and monitoring.
- **GPT-4 (OpenAI API)**: Used for AI-powered relevance analysis of legislative bills.
- **Puppeteer**: Used for server-side PDF generation from HTML templates.
- **Western Verify LLC**: Integrated via Call-To-Actions (CTAs) within the screening toolkit for tenant screening services.
- **Resend**: Email service for sending user notifications.
```