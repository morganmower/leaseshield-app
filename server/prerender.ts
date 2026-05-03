import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";

interface PrerenderEntry {
  title: string;
  description: string;
  bodyHtml: string;
}

const SITE = "https://leaseshieldapp.com";

const CLUSTER_LINKS = `
  <nav aria-label="LeaseShield solutions">
    <h2>Explore the LeaseShield system</h2>
    <ul>
      <li><a href="/rental-management-system">Rental Management System</a> - the full landlord workflow in one place.</li>
      <li><a href="/tenant-screening-services">Tenant Screening Services</a> - complete background, credit, and eviction checks.</li>
      <li><a href="/screening-report-decoder">Screening Report Decoder</a> - AI explains every finding in plain English.</li>
      <li><a href="/rental-application-software">Rental Application Software</a> - one shareable link per property.</li>
      <li><a href="/rent-collection-software">Rent Collection Software</a> - ACH auto-pay with NACHA compliance.</li>
      <li><a href="/landlord-forms-and-notices">Landlord Forms &amp; Notices</a> - state-specific templates for 16 states.</li>
    </ul>
  </nav>
`;

const PRICING_FOOTER = `
  <p><strong>$10/month.</strong> Cancel anytime. 30-day money-back guarantee. No per-unit fees.</p>
  <p><a href="/subscribe">Get started for $10/month</a> &middot; <a href="/screening/explain">Try the screening decoder</a></p>
`;

const PAGES: Record<string, PrerenderEntry> = {
  "/": {
    title: "LeaseShield – Simple Rental Management System for Independent Landlords",
    description:
      "Simple rental management for small landlords across 16 states. Application, screening, lease forms, rent collection, and compliance for $10/month.",
    bodyHtml: `
      <header>
        <h1>Simple rental management system for landlords</h1>
        <p>One simpler system built for independent landlords - application, screening, lease forms, rent collection, and compliance, all in one workflow.</p>
        <p><em>Most landlords only face these decisions a few times per year. LeaseShield is there when they do.</em></p>
      </header>
      <section>
        <h2>The complete landlord workflow</h2>
        <p>Application &rarr; Screening &rarr; Decoder &rarr; Lease &rarr; Rent collection. One workflow, no re-keying between tools.</p>
        ${CLUSTER_LINKS}
      </section>
      <section>
        <h2>Built for the 16 states landlords actually live in</h2>
        <p>State-specific lease templates, compliance cards, and official court forms for Arizona, California, Florida, Idaho, Illinois, Michigan, Nevada, New Mexico, North Carolina, North Dakota, Ohio, South Dakota, Texas, Utah, and more.</p>
      </section>
      ${PRICING_FOOTER}
    `,
  },
  "/screening-report-decoder": {
    title: "Screening Report Decoder - AI Explains Credit, Criminal, and Eviction Findings",
    description:
      "Paste any tenant screening finding and our AI decoder explains it in plain English with Fair Housing-safe next steps. Built into LeaseShield, $10/month.",
    bodyHtml: `
      <header>
        <h1>Screening Report Decoder for Landlords</h1>
        <p>Paste a credit, criminal, or eviction finding. LeaseShield explains what it means, the level of caution, and the Fair Housing-safe questions to ask the applicant.</p>
      </header>
      <section>
        <h2>How the decoder works</h2>
        <ol>
          <li>Paste a finding from your tenant screening report (single line or full list).</li>
          <li>The AI returns a plain-English explanation, caution level (high / medium / low), and follow-up questions.</li>
          <li>State-aware notes pull from a curated, attorney-reviewed database - never AI-generated state law.</li>
        </ol>
      </section>
      <section>
        <h2>Why landlords use it</h2>
        <p>Screening reports are dense and easy to misread. The decoder protects you from Fair Housing missteps, surfaces what the report doesn't say, and turns a 20-minute review into a 90-second decision.</p>
        ${CLUSTER_LINKS}
      </section>
      ${PRICING_FOOTER}
    `,
  },
  "/rental-management-system": {
    title: "Rental Management System for Small Landlords - LeaseShield",
    description:
      "A simple rental management system covering applications, screening, leases, rent collection, and compliance for landlords in 16 US states. $10/month.",
    bodyHtml: `
      <header>
        <h1>Rental management system for independent landlords</h1>
        <p>Most landlord software is built for property managers with hundreds of doors. LeaseShield is built for the landlord with 1&ndash;20 units who needs the right answer a few times a year.</p>
      </header>
      <section>
        <h2>The five-step workflow, one tool</h2>
        <ol>
          <li><strong>Application</strong> - one shareable link per property, branded landlord page.</li>
          <li><strong>Screening</strong> - complete background, credit, and eviction reports.</li>
          <li><strong>Decoder</strong> - AI explains every screening finding in plain English.</li>
          <li><strong>Lease</strong> - state-specific templates and official court forms.</li>
          <li><strong>Rent</strong> - recurring ACH auto-pay with NACHA compliance.</li>
        </ol>
      </section>
      <section>
        <h2>How LeaseShield compares</h2>
        <p>Enterprise platforms charge per unit, lock you into long contracts, and bury the features you actually use. LeaseShield is one flat $10/month, cancel anytime, no per-unit fees, with the workflow small landlords actually run.</p>
        ${CLUSTER_LINKS}
      </section>
      ${PRICING_FOOTER}
    `,
  },
  "/tenant-screening-services": {
    title: "Tenant Screening Services for Landlords - Background, Credit, Eviction",
    description:
      "Complete tenant screening with county-level criminal records, real eviction history, and credit. Plus the AI decoder that explains every finding. $10/month.",
    bodyHtml: `
      <header>
        <h1>Tenant Screening Services for Landlords</h1>
        <p>Most background checks are incomplete. Ours surface what the cheap reports miss - and our AI decoder explains every finding in plain English.</p>
      </header>
      <section>
        <h2>Why most screening misses records</h2>
        <ul>
          <li><strong>County-level verification</strong> - national databases miss 30&ndash;50% of records that only show up at the county level.</li>
          <li><strong>Real eviction history</strong> - court records, not just collection accounts.</li>
          <li><strong>What the report doesn't say</strong> - a clean report doesn't always mean a clean record. The decoder flags gaps.</li>
        </ul>
      </section>
      <section>
        <h2>Built into LeaseShield</h2>
        <p>Screening runs through Western Verify and integrates with the LeaseShield application workflow, decoder, and lease tools. No surprises after move-in. No FCRA missteps before it.</p>
        ${CLUSTER_LINKS}
      </section>
      ${PRICING_FOOTER}
    `,
  },
  "/rental-application-software": {
    title: "Rental Application Software for Landlords - One Link per Property",
    description:
      "Send one branded application link per property. LeaseShield captures applicants, runs screening, and notifies you on every submission. $10/month, cancel anytime.",
    bodyHtml: `
      <header>
        <h1>Rental Application Software for Landlords</h1>
        <p>Auto-generate a shareable applicant link for every property. Track submissions, get email notifications, download QR codes, and pause links when units fill.</p>
      </header>
      <section>
        <h2>What's included</h2>
        <ul>
          <li>Auto-generated applicant link per property with custom slug.</li>
          <li>Per-link analytics (views, submissions, conversion).</li>
          <li>Landlord email notifications on every new application.</li>
          <li>QR code download for offline marketing (yard signs, flyers).</li>
          <li>Pause / resume links without losing data.</li>
          <li>Per-unit security deposit overrides.</li>
        </ul>
      </section>
      <section>
        <h2>Connected to the rest of the workflow</h2>
        <p>Applications flow directly into the screening pipeline, decoder, and lease generator. No re-keying tenant info between tools.</p>
        ${CLUSTER_LINKS}
      </section>
      ${PRICING_FOOTER}
    `,
  },
  "/rent-collection-software": {
    title: "Rent Collection Software with ACH Auto-Pay - LeaseShield",
    description:
      "NACHA-compliant ACH auto-debit, recurring rent collection, tenant-paid service fees, and a full ledger that holds up in court. $10/month, no per-unit fees.",
    bodyHtml: `
      <header>
        <h1>Rent Collection Software for Landlords</h1>
        <p>Recurring monthly ACH auto-pay with full NACHA compliance. Mandatory tenant-paid service fee - you keep 100% of rent.</p>
      </header>
      <section>
        <h2>Built for landlords, not enterprise property managers</h2>
        <ul>
          <li><strong>Recurring auto-pay</strong> - tenants set it once, you stop chasing checks.</li>
          <li><strong>Tenant-paid service fee</strong> - the platform fee is paid by the tenant, not deducted from rent.</li>
          <li><strong>Tabbed dashboard</strong> - Requests, History, Recurring, and Export views.</li>
          <li><strong>Court-ready ledger</strong> - clean record of what was owed and what was paid.</li>
        </ul>
      </section>
      <section>
        <h2>Why a clean ledger matters</h2>
        <p>If you ever need to file an eviction, the ledger is your evidence. LeaseShield logs every charge, payment, late fee, and adjustment with timestamps and tenant attribution.</p>
        ${CLUSTER_LINKS}
      </section>
      ${PRICING_FOOTER}
    `,
  },
  "/landlord-forms-and-notices": {
    title: "Landlord Forms and Notices - State-Specific Templates for 16 States",
    description:
      "Lease agreements, notices to pay or quit, and official court forms for 16 US states. Generated as PDF or DOCX. Compliance-reviewed and statute-referenced.",
    bodyHtml: `
      <header>
        <h1>Landlord Forms and Notices for 16 States</h1>
        <p>State-specific lease agreements, eviction notices, late-rent notices, and official court forms. Generated as PDF (LeaseShield format or Official PDF Overlay) or DOCX.</p>
      </header>
      <section>
        <h2>Covered states</h2>
        <p>Arizona, California, Colorado, Florida, Idaho, Illinois, Michigan, Nevada, New Mexico, North Carolina, North Dakota, Ohio, South Dakota, Texas, Utah, plus expanding coverage. Each state's forms are reviewed against current statutes and county filing requirements.</p>
      </section>
      <section>
        <h2>What you get</h2>
        <ul>
          <li>Residential lease agreements with state-required addenda.</li>
          <li>Notices to pay or quit, cure or quit, and unconditional quit.</li>
          <li>Official court forms via Official PDF Overlay (county-acceptable).</li>
          <li>Statute references on every clause.</li>
          <li>DOCX export for editing in Word or Google Docs.</li>
        </ul>
        ${CLUSTER_LINKS}
      </section>
      ${PRICING_FOOTER}
    `,
  },
};

function injectIntoTemplate(
  template: string,
  entry: PrerenderEntry,
  canonicalUrl: string,
): string {
  let html = template;

  // Title
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${entry.title.replace(/-/g, "-").replace(/&amp;/g, "&")}</title>`,
  );

  // Description
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${entry.description}">`,
  );

  // og:url + og:title + og:description (best-effort, leaves untouched if not present)
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${canonicalUrl}">`,
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${entry.title.replace(/-/g, "-").replace(/&amp;/g, "&")}">`,
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${entry.description}">`,
  );

  // Inject canonical link if not already present
  if (!/<link\s+rel="canonical"/i.test(html)) {
    html = html.replace(
      "</head>",
      `    <link rel="canonical" href="${canonicalUrl}">\n  </head>`,
    );
  }

  // Inject prerendered body into #root. React's createRoot will replace it on hydration.
  // The wrapper has data-prerendered so it is identifiable in dev tools.
  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root"><div data-prerendered="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">${entry.bodyHtml}</div></div>`,
  );

  return html;
}

/**
 * Express middleware that serves prerendered HTML for the marketing route cluster.
 * Crawlers and SEO audit tools see real content (h1, h2, paragraphs, internal links).
 * Real users get the same SPA shell + bundle - React's createRoot replaces the
 * prerendered body on mount, so there is no hydration mismatch and no UX impact.
 *
 * The injected content is visually hidden (clip:rect 0 0 0 0) but fully accessible
 * to crawlers and screen readers until React mounts and replaces it.
 *
 * Registered after API routes but before setupVite / serveStatic.
 */
export function prerenderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method !== "GET") return next();

  // Only prerender in production. In dev, Vite needs to transform index.html
  // (inject HMR client + React refresh) for the SPA to bootstrap, so we let
  // setupVite handle every HTML response.
  if (process.env.NODE_ENV === "development") return next();

  const entry = PAGES[req.path];
  if (!entry) return next();

  // Only intercept HTML requests - never assets or API
  const accept = req.headers.accept || "";
  if (!accept.includes("text/html")) return next();

  try {
    const indexPath = path.resolve(
      import.meta.dirname,
      "public",
      "index.html",
    );

    if (!fs.existsSync(indexPath)) return next();

    const template = fs.readFileSync(indexPath, "utf-8");
    const canonicalUrl = `${SITE}${req.path === "/" ? "/" : req.path}`;
    const html = injectIntoTemplate(template, entry, canonicalUrl);

    res.status(200).set({
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    }).send(html);
  } catch (err) {
    // On any failure, fall through to normal SPA serving
    next();
  }
}

export const PRERENDER_ROUTES = Object.keys(PAGES);
