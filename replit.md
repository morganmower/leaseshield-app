# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform for small and midsize landlords, currently supporting Utah, Texas, North Dakota, South Dakota, and North Carolina. It provides state-specific legal templates, compliance guidance, and tenant screening resources to help landlords safeguard investments and ensure legal compliance.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
The platform uses a blue and slate gray color scheme with a light gray background. Typography features Space Grotesk for headings and Inter for body text. UI patterns include cards, before/after comparisons, badge categorization, and icon-first navigation, maintaining a "protective mentor" tone.

### Technical Implementations
- **Frontend**: React, TypeScript, TanStack Query, Wouter, and Shadcn UI.
- **Backend**: Express.js server, PostgreSQL (Neon), and Drizzle ORM.
- **Authentication**: Replit Auth with session handling.
- **Payments**: Stripe Subscriptions for payment processing and webhook management.
- **Document Assembly Wizard**: Interactive multi-step forms, real-time validation, server-side PDF generation (Puppeteer) with professional, attorney-quality styling, and HTML escaping.
- **Legislative Monitoring**: Automated system (monthly cron jobs, LegiScan API) for tracking state bills, AI (GPT-4) analysis for relevance, auto-publishing of versioned template updates, and user notifications.
- **Template Review & Publishing**: Atomic auto-publishing system with transactional updates, versioning, history, automatic approval, legislative flagging, and instant user notifications via Resend.
- **Email Notifications**: Professional email service (Resend) for legal and template updates.
- **AI Screening Helpers**: GPT-4o-mini-powered tools for credit report and criminal/eviction screening, emphasizing Fair Housing compliance, with "Learn" and "Ask" modes, structured AI responses, and privacy.
- **AI Chat Assistant**: Integrated GPT-4o-mini-powered chat widget (OpenAI) for instant help on landlord-tenant law, platform features, and compliance guidance across all authenticated pages and the landing page.
- **Multi-Property Management**: CRUD operations for properties, document association, and filtering.
- **Document Upload System**: Secure handling of user-uploaded PDF, DOC, DOCX files (up to 20MB) with custom naming, optional property association, and metadata.

### Feature Specifications
- **Subscription Management**: 7-day free trial, $10/month subscription via Stripe Elements and webhooks.
- **Template Library**: State-specific legal documents categorized by use case, downloadable as PDF/DOCX.
- **Compliance Cards**: State-specific "before/after" guidance, explanations, and actionable steps, with links to templates.
- **Screening Toolkit**: Guides for credit reports, background checks, and Fair Housing, with CTAs for Western Verify and AI helpers.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and templates.
- **User Preferences**: Users can set a preferred state for personalized content filtering.
- **Admin Legislative Monitoring UI**: Admin interface for managing published updates, pending bills with AI analysis, and historical data.
- **Admin Resource Management**: CRUD operations for all platform content (Templates, Compliance Cards, Legal Updates) via UI.

### System Design Choices
- **Deployment**: Automated deployments via Replit on push.
- **Database Schema**: Comprehensive schema for users, states, templates, compliance cards, legal updates, analytics, screening, tenant issues, legislative monitoring, notifications, properties, saved and uploaded documents.
- **API Endpoints**: Structured API for authentication, user management, subscriptions, content, legislative monitoring, and administration.

## External Dependencies
- **PostgreSQL (Neon)**: Main relational database.
- **Stripe**: Payment gateway for subscriptions.
- **Replit Auth**: User authentication service.
- **LegiScan API**: Legislative tracking and monitoring.
- **GPT-4 (OpenAI API via Replit AI Integration)**: AI analysis for legislative bills.
- **Puppeteer**: Server-side PDF generation.
- **Western Verify LLC**: Tenant screening services (integrated via CTAs).
- **Resend**: Email service for user notifications.