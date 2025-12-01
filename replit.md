# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform ($10/month with 7-day free trial) for small and midsize landlords. It provides state-specific legal templates, compliance guidance, and tenant screening resources to help landlords protect investments and ensure legal compliance. The platform currently supports Utah, Texas, North Dakota, South Dakota, and North Carolina.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
The platform uses a blue (#2563eb) and slate gray (#475569) color scheme with a light gray background. Typography includes Space Grotesk for headings and Inter for body text. UI patterns feature cards with shadows, before/after layouts, badge categorization, and icon-first navigation, maintaining a "protective mentor" tone.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter, and Shadcn UI.
- **Backend**: Express.js, PostgreSQL (Neon), Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions for processing and webhooks for lifecycle management.
- **Document Assembly Wizard**: Interactive multi-step forms, real-time validation, server-side PDF generation (Puppeteer) with professional, attorney-quality styling.
- **Legislative Monitoring**: Automated monthly cron jobs (LegiScan API) track bills, AI (GPT-4) analyzes relevance, auto-publishes updates with versioning, and notifies users.
- **Template Review & Publishing**: Atomic auto-publishing with transactional updates, versioning, history, automatic approval, legislative flagging, and instant user notifications (Resend).
- **Email Notifications**: Professional email service (Resend) for legal and template updates.
- **AI Screening Helpers**: GPT-4o-mini powered tools for credit report and criminal/eviction screening, focusing on Fair Housing compliance, with "Learn" and "Ask" modes and privacy features.
- **AI Chat Assistant**: GPT-4o-mini via OpenAI provides instant legal and platform assistance across all authenticated and landing pages.
- **Multi-Property Management**: CRUD operations for properties, document association, and filtering.
- **Document Upload System**: Securely handles user uploads (PDF, DOC, DOCX up to 20MB) with custom naming, optional property association, and metadata.

### Feature Specifications
- **Subscription Management**: 7-day free trial, $10/month subscription via Stripe.
- **Template Library**: State-specific legal documents categorized by use case, downloadable as PDF/DOCX.
- **Compliance Cards**: State-specific "before/after" guidance, explanations, and actionable steps with template links.
- **Screening Toolkit**: Guides for credit/background checks and Fair Housing, with CTAs for Western Verify and AI helpers.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and templates.
- **User Preferences**: Users can set preferred state for personalized content.
- **Admin Legislative Monitoring UI**: Admin page for managing published updates, pending bills, and historical data.
- **Admin Resource Management**: CRUD operations for all platform content (Templates, Compliance Cards, Legal Updates).

### System Design Choices
- **Deployment**: Automated deployments via Replit on push.
- **Database Schema**: Covers users, states, templates, compliance cards, legal updates, analytics, screening content, tenant issue workflows, legislative monitoring, notifications, properties, savedDocuments, and uploadedDocuments.
- **API Endpoints**: Structured API for core functionalities including authentication, user management, subscriptions, content, legislative monitoring, and administration.

## External Dependencies
- **PostgreSQL (Neon)**: Relational database.
- **Stripe**: Payment gateway.
- **Replit Auth**: User authentication.
- **LegiScan API**: Legislative tracking.
- **CourtListener API**: Court case tracking.
- **GPT-4 (OpenAI API via Replit AI Integration)**: AI analysis for legislative bills.
- **Puppeteer**: Server-side PDF generation.
- **Western Verify LLC**: Tenant screening services (via CTAs).
- **Resend**: Email service for notifications.