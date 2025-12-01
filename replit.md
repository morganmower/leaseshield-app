# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform ($10/month with 7-day free trial) for small and midsize landlords. Its core purpose is to provide state-specific legal templates, compliance guidance, and tenant screening resources, acting as a "protective mentor." The platform currently supports Utah, Texas, North Dakota, South Dakota, and North Carolina, aiming to safeguard landlord investments and ensure legal compliance.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
The platform uses a primary blue (#2563eb) and secondary slate gray (#475569) color scheme on a light gray background. Typography features Space Grotesk for headings and Inter for body text. Design patterns include cards with shadows, before/after layouts, badge categorization, and icon-first navigation, all contributing to a "protective mentor" tone.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter (routing), and Shadcn UI.
- **Backend**: Express.js server with PostgreSQL (Neon) and Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions for processing and webhooks for lifecycle management.
- **Document Assembly Wizard**: Interactive multi-step forms, real-time validation, server-side PDF generation via Puppeteer (professional, attorney-quality PDFs with specific styling), and HTML escaping.
- **Legislative Monitoring**: Automated monthly cron jobs (LegiScan API) track state bills. GPT-4 analyzes relevance, auto-publishes versioned template updates, and notifies users via email.
- **Template Review & Publishing**: Atomic auto-publishing with versioning, history tracking, automatic approval, legislative flagging, and user notifications (Resend).
- **Email Notifications**: Resend integration for legal and template updates.
- **AI Screening Helpers**: GPT-4o-mini powered tools for credit report and criminal/eviction screening, focusing on Fair Housing compliance, with "Learn" and "Ask" modes and privacy features.
- **AI Chat Assistant**: GPT-4o-mini (OpenAI API) powered chat widget for landlord-tenant law and platform guidance, available on all authenticated and landing pages.
- **Multi-Property Management**: CRUD operations for properties, document association, and filtering.
- **Document Upload System**: Secure handling of user uploads (PDF, DOC, DOCX up to 20MB) with custom naming, optional property association, and metadata.

### Feature Specifications
- **Subscription Management**: 7-day free trial, $10/month subscription via Stripe.
- **Template Library**: State-specific legal documents categorized by use case, downloadable as PDF/DOCX.
- **Compliance Cards**: State-specific "before/after" guidance, explanations, and actionable steps with template links.
- **Screening Toolkit**: Guides for credit reports, background checks, Fair Housing, and CTAs for Western Verify and AI helpers.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and document templates.
- **User Preferences**: State selection for personalized content filtering.
- **Admin Legislative Monitoring UI**: Admin interface for managing published updates, pending bills, and historical data.
- **Admin Resource Management**: CRUD operations for platform content (Templates, Compliance Cards, Legal Updates).

### System Design Choices
- **Deployment**: Automated via Replit.
- **Database Schema**: Comprehensive schema covering users, states, templates, compliance cards, legal updates, analytics, screening content, tenant issue workflows, legislative monitoring, notifications, properties, saved documents, and uploaded documents.
- **API Endpoints**: Structured API for all core functionalities.

## External Dependencies
- **PostgreSQL (Neon)**: Relational database.
- **Stripe**: Payment gateway.
- **Replit Auth**: User authentication.
- **LegiScan API**: Legislative tracking.
- **CourtListener API**: Court case tracking.
- **GPT-4 (OpenAI API via Replit AI Integration)**: AI analysis.
- **Puppeteer**: Server-side PDF generation.
- **Western Verify LLC**: Tenant screening (integrated via CTAs).
- **Resend**: Email service.