# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform for small and midsize landlords, providing state-specific legal templates, compliance guidance, and tenant screening resources. It aims to act as a "protective mentor," safeguarding investments and ensuring legal compliance. The platform currently supports Utah, Texas, North Dakota, South Dakota, and North Carolina.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
The platform uses a primary blue (#2563eb) and secondary slate gray (#475569) color scheme on a light gray background. Space Grotesk is used for headings and Inter for body text. UI patterns include cards with shadows, before/after comparisons, badge-based categorization, and icon-first navigation, all supporting a "protective mentor" tone.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter, Shadcn UI.
- **Backend**: Express.js with PostgreSQL (Neon) via Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions for payment processing and lifecycle events via webhooks.
- **Document Assembly Wizard**: Interactive multi-step forms, real-time validation, server-side PDF generation (Puppeteer) with professional, attorney-quality styling.
- **Legislative Monitoring**: Automated system (LegiScan API) with monthly cron jobs; AI (GPT-4) analyzes relevance, auto-publishes versioned template updates, and notifies users.
- **Template Review & Publishing**: Atomic auto-publishing system with transactional updates, versioning, history tracking, automatic approval, legislative bill flagging, and user notifications (Resend).
- **Email Notifications**: Professional email service (Resend) for legal and template updates.
- **AI Screening Helpers**: GPT-4o-mini tools for credit report and criminal/eviction screening, emphasizing Fair Housing compliance with "Learn" and "Ask" modes, structured responses, and privacy.
- **AI Chat Assistant**: Integrated GPT-4o-mini powered chat widget for landlord-tenant law questions, platform features, and compliance guidance across all authenticated pages and the landing page.
- **Multi-Property Management**: CRUD operations for properties, document association, and filtering.
- **Document Upload System**: Secure handling of user uploads (PDF, DOC, DOCX up to 20MB) with custom naming, optional property association, and metadata.

### Feature Specifications
- **Subscription Management**: 7-day free trial, $10/month subscription (Stripe Elements and webhooks).
- **Template Library**: State-specific legal documents by use case, downloadable as PDF/DOCX.
- **Compliance Cards**: State-specific "before/after" guidance, explanations, and actionable steps, with links to templates.
- **Screening Toolkit**: Guides for credit reports, background checks, and Fair Housing, with CTAs for Western Verify and AI helpers.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and document templates.
- **User Preferences**: Users can set a preferred state for personalized content.
- **Admin Legislative Monitoring UI**: Admin page for managing published updates, pending bills, and historical data.
- **Admin Resource Management**: CRUD operations for all platform content (Templates, Compliance Cards, Legal Updates) via UI.

### System Design Choices
- **Deployment**: Automated deployments via Replit on push.
- **Database Schema**: Comprehensive schema covering users, states, templates, compliance cards, legal updates, analytics, screening content, tenant issue workflows, legislative monitoring data, notifications, properties, savedDocuments, and uploadedDocuments.
- **API Endpoints**: Structured API for authentication, user management, subscriptions, content, legislative monitoring, and administrative tasks.

## External Dependencies
- **PostgreSQL (Neon)**: Main relational database.
- **Stripe**: Payment gateway for subscriptions.
- **Replit Auth**: User authentication service.
- **LegiScan API**: Legislative tracking and monitoring.
- **GPT-4 (OpenAI API via Replit AI Integration)**: AI analysis for legislative bills.
- **Puppeteer**: Server-side PDF generation.
- **Western Verify LLC**: Tenant screening services (integrated via CTAs).
- **Resend**: Email service for user notifications.