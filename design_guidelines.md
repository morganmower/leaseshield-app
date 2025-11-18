# LeaseShield Pro Design Guidelines

## Design Approach

**Selected Approach:** Design System Foundation with SaaS Application Patterns

Drawing inspiration from professional SaaS products like Linear, Notion, and modern legal tech platforms. This approach balances the need for trust/professionalism with the "protective mentor" warmth that differentiates LeaseShield Pro.

**Core Principles:**
- Trust through clarity: Clean, organized layouts that reduce cognitive load
- Protective warmth: Friendly micro-copy and approachable visual hierarchy
- Action-oriented: Clear pathways to essential tools and templates
- Professional credibility: Visual polish that reinforces legal/compliance authority

## Typography

**Font Selection:**
- Primary: Inter or DM Sans (clean, professional, excellent readability)
- Secondary/Accent: Space Grotesk for headings (modern, distinctive without being trendy)

**Hierarchy:**
- Hero/H1: 48px (mobile: 32px), semi-bold
- H2: 36px (mobile: 24px), semi-bold  
- H3: 24px (mobile: 20px), medium
- H4: 20px (mobile: 18px), medium
- Body: 16px, regular
- Small/Legal: 14px, regular
- Captions: 12px, medium

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Consistent component padding: p-6 or p-8
- Section spacing: py-12 to py-20
- Card gaps: gap-6 or gap-8
- Tight groupings: gap-2 or gap-4

**Container Strategy:**
- Max-width: max-w-7xl for dashboard layouts
- max-w-4xl for content-heavy pages (compliance cards, educational content)
- Full-width sections with inner container constraints

## Component Library

### Navigation
**Main Navigation (Dashboard):**
- Sidebar navigation with icon + label (w-64)
- Grouped sections: Screening, Leasing, Compliance, Tenant Issues
- State selector dropdown at top
- Subtle active state indicators (left border accent)

**Public Site Header:**
- Clean horizontal nav with Login/Start Trial CTAs
- Sticky positioning for trial signup visibility

### Cards & Content Blocks

**Template Cards:**
- White background with subtle border
- Icon top-left (document type indicator)
- Title + brief description
- State badge (small pill)
- Download/Fill action buttons at bottom
- Hover: subtle shadow elevation

**Compliance Cards:**
- Larger format with tabbed content
- Before/After comparison view for updates
- Color-coded alert system (amber for new updates)
- Clear "What Changed" and "Why It Matters" sections

**Toolkit Cards (Dashboard):**
- Large clickable cards (3-column grid on desktop)
- Icon + title + 2-line description
- Arrow or chevron indicating entry point

### Forms & Inputs

**Form Fields:**
- Clear labels above inputs
- Generous padding (py-3 px-4)
- Border on all states (not just on focus)
- Focus: border color shift + subtle glow
- Error states: red border + icon + message below

**Buttons:**
- Primary: solid background, medium weight text, px-6 py-3
- Secondary: outline style with transparent background
- Disabled: reduced opacity (0.5)
- Rounded corners: rounded-lg

### Notifications & Alerts

**Legal Update Alerts:**
- Prominent amber/yellow banner for new updates
- Icon + headline + action link
- Dismissible with close icon
- Dashboard notification center with unread count badge

**System Messages:**
- Toast notifications (top-right): Success (green), Info (blue), Warning (amber), Error (red)
- Inline contextual help with info icons

### Data Display

**Template Library:**
- Table or grid view toggle
- Filters sidebar (by state, type, category)
- Search bar prominent at top
- Sort options (newest, most used, alphabetical)

**Q&A Archive:**
- Video thumbnail grid (3-column)
- Category tags visible on each
- Date + duration metadata
- Search + category filter

### Overlays & Modals

**Modal Windows:**
- Centered, max-w-2xl
- Dark overlay backdrop (opacity-50)
- Close X in top-right
- Clear modal title and action buttons at bottom

**Onboarding Quiz:**
- Progress indicator at top
- Single question per screen
- Large, tappable answer cards
- Next/Previous navigation

## Animations

**Minimal Motion:**
- Page transitions: simple fade (150ms)
- Card hover: subtle scale (1.02) + shadow
- Button interactions: opacity shift
- Avoid: complex scroll animations, parallax, auto-playing elements

**Loading States:**
- Skeleton screens for template lists
- Spinner for form submissions
- Progress bar for multi-step processes

## Images

**Hero Section (Marketing/Landing):**
- Large hero image showing confident landlord or organized property workspace
- Image: Professional photography, warm tones, human element
- Placement: Right side on desktop (60% width), full-width on mobile
- Overlay: Semi-transparent gradient for text readability

**Supporting Images:**
- Dashboard screenshots showing clean interface (use in Features section)
- Icons throughout for toolkits and categories (Heroicons)
- Compliance card examples (actual product screenshots)
- NO stock photos of generic business people; prefer product UI or authentic landlord scenarios

## Page-Specific Layouts

### Landing Page
- Hero: Left-aligned headline + CTA, right-side image
- Social proof bar: "Trusted by X landlords in 4 states"
- Features grid: 3 columns showcasing Compliance, Templates, Screening
- How It Works: 3-step visual workflow
- Pricing: Single plan card (centered), feature list, trial CTA
- FAQ: Accordion-style, 6-8 common questions
- Footer: Links, contact, trust badges

### Dashboard (Post-Login)
- Left sidebar navigation
- Top bar: State selector, notifications, profile menu
- Main content area: Welcome message + 3 "Start Here" cards
- Recent updates section
- Quick access to most-used templates

### Template Library
- Left: Filter sidebar (state, type, category)
- Right: Grid of template cards (2-3 columns)
- Top: Search bar + view toggle + sort dropdown

### Compliance Card Pages
- Full-width layout with sticky sidebar navigation (on-page anchors)
- Tabbed content: Overview, Requirements, Recent Updates
- Before/after comparison module for law changes
- Download related templates at bottom

### Screening Toolkit
- Educational content in prose format (max-w-3xl)
- Expandable sections for each topic
- Embedded checklists and "red flag" callouts
- Western Verify CTA card at strategic points

This design system creates a professional, trustworthy experience that feels warm and supportive—exactly the "protective mentor" tone LeaseShield Pro requires. Clean information architecture combined with thoughtful visual hierarchy ensures landlords feel confident and in control.