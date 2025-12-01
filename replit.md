# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform ($10/month with 7-day free trial) for small and midsize landlords. Its purpose is to provide state-specific legal templates, compliance guidance, and tenant screening resources, acting as a "protective mentor" to safeguard investments and ensure legal compliance. The platform currently supports Utah, Texas, North Dakota, South Dakota, and North Carolina.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
The platform uses a blue (#2563eb) and slate gray (#475569) color scheme with a light gray background. Typography includes Space Grotesk for headings and Inter for body text. UI patterns feature cards with subtle shadows, before/after comparisons, badge-based categorization, and icon-first navigation, all maintaining a "protective mentor" tone.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter for routing, Shadcn UI.
- **Backend**: Express.js server, PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions for processing and webhooks for lifecycle management.
- **Document Assembly Wizard**: Interactive multi-step forms, real-time validation, server-side PDF generation (Puppeteer) with professional styling and HTML escaping.
- **Legislative Monitoring**: Automated monthly cron jobs (LegiScan API) track state bills. AI (GPT-4) analyzes relevance, auto-publishes versioned template updates, and notifies users via email.
- **Template Review & Publishing**: Atomic auto-publishing system with versioning, history, automatic approval, legislative bill flagging, and user notifications (Resend).
- **Email Notifications**: Professional email service (Resend) for legal and template updates.
- **AI Screening Helpers**: Two AI tools (GPT-4o-mini) for credit report, criminal, and eviction screening, focusing on Fair Housing compliance, with "Learn" and "Ask" modes.
- **AI Chat Assistant**: Integrated AI chat (GPT-4o-mini via OpenAI) for legal questions, platform features, and compliance guidance across all authenticated pages and the landing page.
- **Multi-Property Management**: CRUD operations for properties, document association, and filtering.
- **Document Upload System**: Secure handling of user uploads (PDF, DOC, DOCX up to 20MB) with custom naming, optional property association, and metadata.
- **Compliance Toolkit**: Interactive cards display state-specific legal requirements, statute citations, key requirements, and actionable steps.

### Feature Specifications
- **Subscription Management**: 7-day free trial, $10/month subscription via Stripe Elements and webhooks.
- **Template Library**: State-specific legal documents categorized by use case, downloadable as PDF/DOCX, including statute references.
- **Compliance Cards**: State-specific guidance with `Legal Authority` (statute citations), `Key Requirements`, and `Actionable Steps`.
- **Screening Toolkit**: Guides for credit reports, background checks, Fair Housing, with CTAs for Western Verify integration and AI helpers.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and document templates.
- **User Preferences**: Users can set preferred state for personalized content.
- **Admin Legislative Monitoring UI**: Manages published updates, pending bills with AI analysis, and historical data.
- **Admin Resource Management**: CRUD operations for Templates, Compliance Cards, and Legal Updates via UI.

### System Design Choices
- **Deployment**: Automated deployments via Replit on push.
- **Database Schema**: Comprehensive schema for users, states, templates, compliance cards, legal updates, analytics, screening content, tenant issue workflows, legislative monitoring, notifications, properties, saved documents, and uploaded documents.
- **API Endpoints**: Structured API for authentication, user management, subscriptions, content, legislative monitoring, and administrative tasks.

## External Dependencies
- **PostgreSQL (Neon)**: Relational database.
- **Stripe**: Payment gateway.
- **Replit Auth**: Authentication service.
- **LegiScan API**: Legislative tracking.
- **GPT-4 (OpenAI API via Replit AI Integration)**: AI for legislative analysis.
- **Puppeteer**: Server-side PDF generation.
- **Western Verify LLC**: Tenant screening services (via CTAs).
- **Resend**: Email notification service.