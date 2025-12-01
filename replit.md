# LeaseShield App - SaaS Platform for Landlords

## Overview
LeaseShield App is a subscription-based SaaS platform for small and midsize landlords, providing state-specific legal templates, compliance guidance, and tenant screening resources. It aims to act as a "protective mentor," safeguarding investments and ensuring legal compliance. The platform currently supports Utah, Texas, North Dakota, South Dakota, and North Carolina.

## User Preferences
Not specified.

## System Architecture

### UI/UX Decisions
The platform utilizes a primary blue (#2563eb) and secondary slate gray (#475569) color scheme with a light gray background. Typography uses Space Grotesk for headings and Inter for body text. Common UI patterns include cards with subtle shadows, before/after comparison layouts, badge-based categorization, and icon-first navigation. The user experience maintains a "protective mentor" tone.

### Technical Implementations
- **Frontend**: Built with React, TypeScript, TanStack Query, Wouter for routing, and Shadcn UI components.
- **Backend**: An Express.js server connected to a PostgreSQL database (via Neon) using Drizzle ORM.
- **Authentication**: Managed via Replit Auth with session handling.
- **Payments**: Stripe Subscriptions are integrated for payment processing, with webhooks managing subscription lifecycle events.
- **Document Assembly Wizard**: Features interactive multi-step forms with real-time validation, server-side PDF generation using Puppeteer, and robust HTML escaping. Generated PDFs have a professional, attorney-quality appearance with specific styling (letterhead, Times New Roman, enhanced margins, formal signature blocks).
- **Legislative Monitoring**: An automated system with monthly cron jobs (LegiScan API) tracks state bills. AI (GPT-4) analyzes relevance, auto-publishes template updates with versioning, and notifies users via email.
- **Template Review & Publishing**: An atomic auto-publishing system ensures transactional updates with versioning, history tracking, automatic approval, legislative bill flagging, and immediate user notifications via Resend.
- **Email Notifications**: Integrated with a professional email service (e.g., Resend) for legal and template update notifications.
- **AI Screening Helpers**: Two AI-powered tools (GPT-4o-mini) assist with credit report analysis and criminal/eviction screening, emphasizing Fair Housing compliance. They include "Learn" and "Ask" modes, structured AI responses, and privacy protections for sensitive data.
- **AI Chat Assistant**: An integrated AI-powered chat widget (GPT-4o-mini via OpenAI) provides instant help with landlord-tenant law questions, platform features, and compliance guidance across all authenticated pages and the landing page.
- **Multi-Property Management**: Allows CRUD operations for properties, associating documents, and filtering.
- **Document Upload System**: Securely handles user uploads (PDF, DOC, DOCX up to 20MB) with custom naming, optional property association, and metadata.

### Feature Specifications
- **Subscription Management**: Offers a 7-day free trial and a $10/month subscription model, powered by Stripe Elements and webhooks.
- **Template Library**: Provides state-specific legal documents categorized by use case, available for download as PDF/DOCX.
- **Compliance Cards**: Offers state-specific "before/after" guidance, explanations, and actionable steps, with optional links to related templates.
- **Screening Toolkit**: Guides for credit reports, background checks, and Fair Housing, with CTAs for Western Verify integration and AI-powered helpers.
- **Tenant Issue Workflows**: Step-by-step resolution guides with state-specific procedures and document templates.
- **User Preferences**: Users can set their preferred state for personalized content filtering.
- **Admin Legislative Monitoring UI**: A dedicated admin page manages published updates, pending bills with AI analysis, and historical data.
- **Admin Resource Management**: CRUD operations for all platform content (Templates, Compliance Cards, Legal Updates) directly via the UI.

### System Design Choices
- **Deployment**: Automated deployments via Replit on push.
- **Database Schema**: Comprehensive schema covering users, states, templates, compliance cards, legal updates, analytics, screening content, tenant issue workflows, legislative monitoring data, notifications, properties, savedDocuments, and uploadedDocuments.
- **API Endpoints**: Structured API for all core functionalities including authentication, user management, subscriptions, content, legislative monitoring, and administrative tasks.

## External Dependencies
- **PostgreSQL (Neon)**: Main relational database.
- **Stripe**: Payment gateway for subscriptions.
- **Replit Auth**: User authentication service.
- **LegiScan API**: Legislative tracking and monitoring.
- **CourtListener API**: Court case and legal precedent tracking.
- **GPT-4 (OpenAI API via Replit AI Integration)**: Powers AI analysis for legislative bills.
- **Puppeteer**: Used for server-side PDF generation.
- **Western Verify LLC**: Integrated via CTAs for tenant screening services.
- **Resend**: Email service for user notifications.