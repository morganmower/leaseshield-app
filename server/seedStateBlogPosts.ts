import { db } from "./db";
import { blogPosts, templates } from "@shared/schema";
import { sql, inArray } from "drizzle-orm";

interface PublishedCountRow {
  n: number;
}

type StateData = {
  code: string;
  name: string;
  slug: string; // e.g. "texas"
  payQuitDays: number;
  payQuitNoticeName: string;
  depositCap: string;
  depositReturnDays: string;
};

const STATES: StateData[] = [
  { code: "AZ", name: "Arizona", slug: "arizona",
    payQuitDays: 5, payQuitNoticeName: "5-Day Notice to Pay or Quit",
    depositCap: "1.5 months' rent",
    depositReturnDays: "14 days after written demand and return of possession" },
  { code: "CA", name: "California", slug: "california",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Pay or Quit",
    depositCap: "one month's rent for most rentals (effective July 1, 2024)",
    depositReturnDays: "21 days" },
  { code: "FL", name: "Florida", slug: "florida",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Pay or Vacate (excluding weekends and holidays)",
    depositCap: "no statutory cap",
    depositReturnDays: "15 days if no claim is made; 30 days if you intend to keep any portion" },
  { code: "ID", name: "Idaho", slug: "idaho",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Pay or Quit",
    depositCap: "no statutory cap",
    depositReturnDays: "21 days (or 30 days if specified in the lease)" },
  { code: "IL", name: "Illinois", slug: "illinois",
    payQuitDays: 5, payQuitNoticeName: "5-Day Notice to Pay or Quit",
    depositCap: "no statewide cap (Chicago: capped by ordinance)",
    depositReturnDays: "30 days (45 if itemized deductions are taken)" },
  { code: "MI", name: "Michigan", slug: "michigan",
    payQuitDays: 7, payQuitNoticeName: "7-Day Demand for Possession (DC 100a)",
    depositCap: "1.5 months' rent",
    depositReturnDays: "30 days to provide an itemized list of deductions" },
  { code: "NC", name: "North Carolina", slug: "north-carolina",
    payQuitDays: 10, payQuitNoticeName: "10-Day Notice to Pay or Quit",
    depositCap: "two months' rent for leases longer than two months",
    depositReturnDays: "30 days (or up to 60 if final damages are still being assessed)" },
  { code: "ND", name: "North Dakota", slug: "north-dakota",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Pay or Quit",
    depositCap: "one month's rent (up to two months for tenants with pets or felony convictions)",
    depositReturnDays: "30 days" },
  { code: "NM", name: "New Mexico", slug: "new-mexico",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Pay or Quit",
    depositCap: "one month's rent for leases under one year",
    depositReturnDays: "30 days" },
  { code: "NV", name: "Nevada", slug: "nevada",
    payQuitDays: 7, payQuitNoticeName: "7-Day Notice to Pay or Quit",
    depositCap: "three months' rent",
    depositReturnDays: "30 days" },
  { code: "OH", name: "Ohio", slug: "ohio",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Leave the Premises",
    depositCap: "no statutory cap",
    depositReturnDays: "30 days" },
  { code: "SD", name: "South Dakota", slug: "south-dakota",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Pay or Quit",
    depositCap: "one month's rent in most cases",
    depositReturnDays: "two weeks to return the deposit (45 days to provide a written itemization on request)" },
  { code: "TX", name: "Texas", slug: "texas",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Vacate",
    depositCap: "no statutory cap",
    depositReturnDays: "30 days after the tenant moves out and provides a forwarding address" },
  { code: "UT", name: "Utah", slug: "utah",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Pay or Quit",
    depositCap: "no statutory cap",
    depositReturnDays: "30 days after the tenant vacates and delivers a forwarding address" },
  { code: "VA", name: "Virginia", slug: "virginia",
    payQuitDays: 5, payQuitNoticeName: "5-Day Notice to Pay or Quit",
    depositCap: "two months' rent",
    depositReturnDays: "45 days" },
  { code: "WY", name: "Wyoming", slug: "wyoming",
    payQuitDays: 3, payQuitNoticeName: "3-Day Notice to Pay or Quit",
    depositCap: "no statutory cap",
    depositReturnDays: "30 days (60 days if there is damage to the unit)" },
];

// Per-state CTA template links resolved from the templates table at seed time.
type StateCtaIds = {
  evictId: string;
  depositId: string;
  leaseId: string;
  screeningId: string;
};

// Preferred template_type for each CTA, with fallbacks. The first type that
// exists for the state wins. This insulates the seed from environment-specific
// UUIDs and from minor variations in which template_types each state has.
const CTA_TYPE_FALLBACKS: Record<keyof StateCtaIds, string[]> = {
  evictId:     ["late_rent_notice", "eviction_notice", "notice_to_vacate", "lease_violation_notice"],
  depositId:   ["deposit_itemization", "move_out_checklist", "move_in_checklist"],
  leaseId:     ["lease"],
  screeningId: ["application", "screening_authorization", "adverse_action"],
};

const IMAGES = {
  evict: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
  deposit: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80",
  lease: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80",
  screen: "https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=1200&q=80",
};

const cta = (templateId: string, label: string) =>
  `<p><strong>Get the form:</strong> Open the <a href="/templates/${templateId}">${label}</a> in LeaseShield to fill it out and download a court-ready copy in minutes.</p>`;

const subscribeCta = `
  <h2>Stay protected, every month</h2>
  <p>LeaseShield gives you state-specific lease templates, eviction notices, screening forms, and compliance updates the moment laws change. <a href="/subscribe">Start a LeaseShield subscription</a> for $10/month and stop guessing whether your paperwork is current.</p>
`;

function evictionArticle(s: StateData, ctas: StateCtaIds) {
  const evictLabel = `${s.payQuitNoticeName} (${s.code})`;
  return {
    title: `How to Evict a Tenant in ${s.name}: Step-by-Step Guide for Landlords`,
    slug: `how-to-evict-a-tenant-in-${s.slug}`,
    excerpt: `A complete walkthrough of the ${s.name} eviction process - from serving the ${s.payQuitNoticeName} to obtaining a writ of possession.`,
    metaTitle: `How to Evict a Tenant in ${s.name} | ${s.payQuitNoticeName} | LeaseShield`,
    metaDescription: `${s.name} eviction guide: serve a ${s.payQuitNoticeName}, file the complaint, attend the hearing, and get a writ. Forms, timelines, and legal pitfalls explained.`,
    stateIds: [s.code],
    tags: ["evictions", "notices", s.slug, "legal-process"],
    featuredImageUrl: IMAGES.evict,
    content: `
      <p>Evicting a tenant in ${s.name} is one of the most stressful tasks a landlord can face. The process is highly procedural - miss a deadline or use the wrong form, and the court will throw your case out. Use this guide to move through each step the right way.</p>

      <h2>Step 1: Make sure you have legal cause</h2>
      <p>${s.name} courts grant evictions for specific reasons:</p>
      <ul>
        <li>Non-payment of rent</li>
        <li>Material lease violations (unauthorized occupants, pets, damage, illegal activity)</li>
        <li>Holdover after the lease term ends</li>
        <li>Owner move-in or substantial remodel (in jurisdictions that allow no-fault)</li>
      </ul>
      <p>Self-help evictions - changing locks, removing belongings, or shutting off utilities - are illegal and can result in serious damages.</p>

      <h2>Step 2: Serve the proper notice</h2>
      <p>For non-payment, ${s.name} requires a <strong>${s.payQuitNoticeName}</strong>. The notice must include the exact amount owed, instructions for payment, and the date by which the tenant must comply or surrender possession.</p>
      ${cta(ctas.evictId, evictLabel)}

      <h2>Step 3: File the eviction complaint</h2>
      <p>If the tenant does not pay or vacate within ${s.payQuitDays} days, file an eviction complaint (sometimes called a forcible entry and detainer or unlawful detainer) in the justice or district court for the county where the property is located. Bring:</p>
      <ul>
        <li>A signed copy of the lease</li>
        <li>The original notice and proof of service</li>
        <li>A rent ledger showing unpaid amounts</li>
        <li>The filing fee (varies by county)</li>
      </ul>

      <h2>Step 4: Serve the summons and complaint</h2>
      <p>The court will issue a summons. A constable, sheriff, or licensed process server must deliver the summons and complaint to the tenant - you cannot serve it yourself. Keep the proof of service for your hearing.</p>

      <h2>Step 5: Attend the hearing</h2>
      <p>Hearings in ${s.name} are typically scheduled within 10 to 21 days of filing. Bring everything you filed, plus photos and communication records. Be ready to answer questions about notice, lease terms, and any partial payments you accepted.</p>

      <h2>Step 6: Get a writ of possession</h2>
      <p>If the judge rules in your favor, you can request a writ of restitution (also called a writ of possession). The sheriff will post the writ and remove the tenant if they have not vacated.</p>

      <h2>Common mistakes that get cases dismissed</h2>
      <ul>
        <li>Accepting partial rent after notice (this can void your case)</li>
        <li>Using a generic out-of-state template that does not meet ${s.name}'s notice rules</li>
        <li>Filing in the wrong court</li>
        <li>Skipping proof of service</li>
      </ul>

      <h2>Timeline at a glance</h2>
      <p>From notice to writ, a clean ${s.name} eviction usually takes <strong>3 to 6 weeks</strong>. Contested cases can take longer.</p>

      ${subscribeCta}
    `,
    publishedAt: new Date("2025-09-15"),
  };
}

function depositArticle(s: StateData, ctas: StateCtaIds) {
  const depositLabel = `${s.name} security-deposit form`;
  return {
    title: `${s.name} Security Deposit Laws: Complete Landlord Guide`,
    slug: `${s.slug}-security-deposit-laws`,
    excerpt: `Caps, deductions, return deadlines, and itemization rules every ${s.name} landlord needs to know to avoid penalties.`,
    metaTitle: `${s.name} Security Deposit Laws for Landlords | LeaseShield`,
    metaDescription: `${s.name} security-deposit guide: ${s.depositCap}, return within ${s.depositReturnDays}. Allowed deductions, itemization rules, and bad-faith penalties explained.`,
    stateIds: [s.code],
    tags: ["security-deposits", "compliance", s.slug, "move-out"],
    featuredImageUrl: IMAGES.deposit,
    content: `
      <p>Security-deposit disputes are the single most common reason landlords end up in court. ${s.name} has clear rules - and the penalties for getting them wrong can be triple damages plus attorney's fees. Here's what every ${s.name} landlord needs to know.</p>

      <h2>How much can you charge?</h2>
      <p>${s.name} caps security deposits at <strong>${s.depositCap}</strong>. Charging more than the legal maximum can void your right to keep any of it.</p>

      <h2>Hold the deposit correctly</h2>
      <p>Best practice - and required in many jurisdictions - is to keep deposits in a separate account, not commingled with operating funds. Document where the deposit is held and disclose this in the lease.</p>

      <h2>Return deadline</h2>
      <p>You must return the deposit (and any itemized accounting of deductions) within <strong>${s.depositReturnDays}</strong>. The clock starts when the tenant surrenders possession and provides a forwarding address.</p>

      <h2>What you can deduct</h2>
      <ul>
        <li>Unpaid rent</li>
        <li>Damage beyond ordinary wear and tear</li>
        <li>Cleaning needed to restore the unit to move-in condition</li>
        <li>Unpaid utility bills (if the lease assigns them to the tenant)</li>
      </ul>

      <h2>What you cannot deduct</h2>
      <ul>
        <li>Normal wear and tear (faded paint, light carpet wear, small nail holes)</li>
        <li>Pre-existing damage that was not documented at move-in</li>
        <li>Lost-rent claims for periods you re-rented the unit</li>
      </ul>

      <h2>Itemize, photograph, and document</h2>
      <p>Always send a written itemization with receipts or estimates. Take date-stamped photos at move-out and compare them against your move-in inspection. Mail the deposit balance and itemization by certified mail to create a paper trail.</p>
      ${cta(ctas.depositId, depositLabel)}

      <h2>Penalties for getting it wrong</h2>
      <p>${s.name} courts can award the tenant double or triple the wrongfully withheld amount, plus attorney's fees, when a landlord acts in bad faith. A $1,500 deposit dispute can easily become a $6,000 judgment.</p>

      <h2>Quick compliance checklist</h2>
      <ul>
        <li>Cap the deposit at the legal limit (${s.depositCap})</li>
        <li>Conduct and document a move-in inspection</li>
        <li>Conduct and document a move-out inspection</li>
        <li>Send an itemized statement within the legal window</li>
        <li>Use certified mail for the deposit return</li>
      </ul>

      ${subscribeCta}
    `,
    publishedAt: new Date("2025-09-22"),
  };
}

function leaseArticle(s: StateData, ctas: StateCtaIds) {
  return {
    title: `${s.name} Lease Agreement Requirements: What Landlords Must Include`,
    slug: `${s.slug}-lease-agreement-requirements`,
    excerpt: `Required clauses, mandatory disclosures, and lease terms every ${s.name} residential rental agreement needs to be enforceable.`,
    metaTitle: `${s.name} Lease Agreement Requirements | LeaseShield`,
    metaDescription: `Build a legally enforceable ${s.name} lease. Required disclosures, security-deposit clauses, rent rules, late fees, entry rights, and termination terms.`,
    stateIds: [s.code],
    tags: ["leases", "compliance", s.slug, "disclosures"],
    featuredImageUrl: IMAGES.lease,
    content: `
      <p>A great ${s.name} lease does two things: it sets expectations clearly with the tenant, and it gives you the legal footing to enforce those expectations in court. A weak lease - or a generic out-of-state template - can leave you unable to collect unpaid rent or evict a problem tenant.</p>

      <h2>Required clauses for every ${s.name} lease</h2>
      <ul>
        <li><strong>Parties and property</strong> - full legal names of all adult occupants and the complete unit address</li>
        <li><strong>Term</strong> - start and end date, or month-to-month designation</li>
        <li><strong>Rent</strong> - amount, due date, accepted payment methods, and where to pay</li>
        <li><strong>Late fees</strong> - amount and grace period (must be reasonable under ${s.name} law)</li>
        <li><strong>Security deposit</strong> - amount (capped at ${s.depositCap}) and where it is held</li>
        <li><strong>Maintenance and repairs</strong> - who is responsible for what</li>
        <li><strong>Entry rights</strong> - at least 24 hours' written notice for non-emergency entry</li>
        <li><strong>Termination</strong> - notice periods for ending the tenancy</li>
      </ul>

      <h2>Mandatory disclosures</h2>
      <p>Federal law requires a lead-paint disclosure for any property built before 1978. ${s.name} adds its own disclosures depending on the property - common ones include:</p>
      <ul>
        <li>Owner / agent contact information for service of legal notices</li>
        <li>Existing damage at move-in</li>
        <li>Mold history (where applicable)</li>
        <li>Bedbug, asbestos, or other property-condition disclosures required locally</li>
      </ul>

      <h2>Clauses that often backfire</h2>
      <ul>
        <li>Waivers of the implied warranty of habitability (unenforceable)</li>
        <li>Self-help eviction language (illegal in every state, including ${s.name})</li>
        <li>"Pet rent" that is actually treated as additional security (counts toward the cap)</li>
        <li>Excessive late fees that courts will refuse to enforce</li>
      </ul>

      <h2>Use a ${s.name}-specific template</h2>
      <p>The fastest way to make sure your lease is enforceable is to start from a state-specific template that has been kept current with ${s.name} statutes and case law.</p>
      ${cta(ctas.leaseId, `${s.name} Residential Lease Agreement`)}

      <h2>Sign, date, and store</h2>
      <p>Every adult occupant should sign. Provide each tenant with a fully-executed copy and keep your originals (or signed PDFs) in your tenant file. Re-sign - don't just verbally renew - at the end of every term.</p>

      ${subscribeCta}
    `,
    publishedAt: new Date("2025-09-29"),
  };
}

function screeningArticle(s: StateData, ctas: StateCtaIds) {
  return {
    title: `Tenant Screening in ${s.name}: Fair Housing & Legal Compliance Guide`,
    slug: `tenant-screening-${s.slug}`,
    excerpt: `Run a tight, defensible screening process in ${s.name} - from application and credit check to adverse-action notices.`,
    metaTitle: `Tenant Screening in ${s.name} | Fair Housing Compliance | LeaseShield`,
    metaDescription: `Screen ${s.name} rental applicants the right way. Application, credit and background checks, FCRA adverse-action notices, and Fair Housing rules explained.`,
    stateIds: [s.code],
    tags: ["tenant-screening", "fair-housing", s.slug, "compliance"],
    featuredImageUrl: IMAGES.screen,
    content: `
      <p>Tenant screening is your single best risk-management tool - and your single biggest Fair Housing liability if you do it wrong. This guide walks through a compliant screening process for ${s.name} landlords.</p>

      <h2>Start with written screening criteria</h2>
      <p>Before you publish a listing, write down the standards every applicant must meet:</p>
      <ul>
        <li>Minimum income (commonly 2.5–3x monthly rent)</li>
        <li>Minimum credit score</li>
        <li>Acceptable rental history</li>
        <li>How you handle criminal records (individualized assessment, not a blanket ban)</li>
      </ul>
      <p>Apply the same criteria to every applicant in the order their applications are received. Inconsistency is the easiest way to lose a Fair Housing complaint.</p>

      <h2>Use a real rental application</h2>
      <p>Collect contact info, employment, income, rental history, and authorization to run credit and background checks.</p>
      ${cta(ctas.screeningId, `${s.name} Rental Application`)}

      <h2>Pull credit and background reports</h2>
      <p>You must obtain written consent before running any consumer report. Use a Fair Credit Reporting Act (FCRA) compliant screening service. Never make an adverse decision based on information you have not independently verified.</p>

      <h2>Federal Fair Housing protections</h2>
      <p>It is illegal to discriminate based on:</p>
      <ul>
        <li>Race or color</li>
        <li>National origin</li>
        <li>Religion</li>
        <li>Sex (including sexual orientation and gender identity)</li>
        <li>Familial status (children under 18 in the household, pregnant tenants)</li>
        <li>Disability</li>
      </ul>
      <p>${s.name} and many cities add additional protected classes - check your local ordinances before publishing screening criteria.</p>

      <h2>Service and emotional support animals</h2>
      <p>Service and emotional support animals are not pets. You cannot charge pet rent, pet deposits, or apply a no-pet policy to them. You may request appropriate documentation when the disability or need is not obvious.</p>

      <h2>Send adverse-action notices</h2>
      <p>If you deny an applicant, raise the deposit, or impose stricter terms based on a consumer report, FCRA requires you to send an adverse-action notice that tells the applicant which agency provided the report and how to dispute it.</p>

      <h2>Document everything</h2>
      <p>Keep every application, every screening report, and a written reason for every decision for at least the statute of limitations. This is your defense if a denied applicant files a complaint.</p>

      ${subscribeCta}
    `,
    publishedAt: new Date("2025-10-06"),
  };
}

export async function seedStateBlogPosts() {
  console.log("Seeding state-by-state blog posts...");

  // 1. Resolve CTA template IDs dynamically from the templates table by
  // (state_id, template_type). This avoids hardcoding environment-specific
  // UUIDs - any deployment that has run the standard templates seed will
  // resolve the right link automatically.
  const stateCodes = STATES.map((s) => s.code);
  const allTemplates = await db
    .select({
      id: templates.id,
      stateId: templates.stateId,
      templateType: templates.templateType,
      sortOrder: templates.sortOrder,
    })
    .from(templates)
    .where(inArray(templates.stateId, stateCodes));

  // Map of `${stateId}:${templateType}` -> first template id (lowest sortOrder).
  const byKey = new Map<string, string>();
  const sorted = [...allTemplates].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  for (const t of sorted) {
    const key = `${t.stateId}:${t.templateType}`;
    if (!byKey.has(key)) byKey.set(key, t.id);
  }

  function resolveCta(stateId: string, slot: keyof StateCtaIds): string | null {
    for (const type of CTA_TYPE_FALLBACKS[slot]) {
      const id = byKey.get(`${stateId}:${type}`);
      if (id) return id;
    }
    return null;
  }

  const ctaByState = new Map<string, StateCtaIds>();
  const unresolved: string[] = [];
  for (const s of STATES) {
    const evictId = resolveCta(s.code, "evictId");
    const depositId = resolveCta(s.code, "depositId");
    const leaseId = resolveCta(s.code, "leaseId");
    const screeningId = resolveCta(s.code, "screeningId");
    const missingSlots = [
      ["evictId", evictId],
      ["depositId", depositId],
      ["leaseId", leaseId],
      ["screeningId", screeningId],
    ].filter(([, v]) => !v).map(([k]) => k as string);
    if (missingSlots.length > 0) {
      unresolved.push(`${s.code}: ${missingSlots.join(", ")}`);
      continue;
    }
    ctaByState.set(s.code, {
      evictId: evictId!,
      depositId: depositId!,
      leaseId: leaseId!,
      screeningId: screeningId!,
    });
  }

  if (unresolved.length > 0) {
    throw new Error(
      `seedStateBlogPosts aborted: could not resolve CTA template links for ` +
        `${unresolved.length} state(s). Run the templates seed first ` +
        `(tsx server/seed.ts and any state-specific template seeds). Missing:\n  ` +
        unresolved.join("\n  "),
    );
  }
  console.log(`  ✓ Resolved CTA template links for all ${STATES.length} states.`);

  // 2. Make sure the original 5 seed posts are flagged as published.
  await db.execute(sql`
    UPDATE blog_posts
    SET is_published = true
    WHERE slug IN (
      'utah-landlord-legal-mistakes',
      'texas-security-deposit-law-guide',
      'north-dakota-tenant-screening-fair-housing',
      'south-dakota-eviction-process-guide',
      'handling-late-rent-payments-landlords'
    ) AND is_published = false
  `);

  let inserted = 0;
  let alreadyExisted = 0;
  let errored = 0;

  for (const s of STATES) {
    const ctas = ctaByState.get(s.code)!;
    const articles = [
      evictionArticle(s, ctas),
      depositArticle(s, ctas),
      leaseArticle(s, ctas),
      screeningArticle(s, ctas),
    ];

    for (const a of articles) {
      try {
        // Use .returning() so we know whether the row was actually inserted
        // (returns the new id) or skipped because the slug already existed.
        const result = await db
          .insert(blogPosts)
          .values({
            title: a.title,
            slug: a.slug,
            excerpt: a.excerpt,
            content: a.content,
            author: "LeaseShield Legal Content Team",
            featuredImageUrl: a.featuredImageUrl,
            metaTitle: a.metaTitle,
            metaDescription: a.metaDescription,
            stateIds: a.stateIds,
            tags: a.tags,
            isPublished: true,
            publishedAt: a.publishedAt,
          })
          .onConflictDoNothing({ target: blogPosts.slug })
          .returning({ id: blogPosts.id });

        if (result.length > 0) {
          inserted++;
          console.log(`✓ ${s.code}: ${a.title}`);
        } else {
          alreadyExisted++;
          console.log(`↺ ${s.code}: already exists, skipped: ${a.slug}`);
        }
      } catch (err: unknown) {
        errored++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`✗ ${a.slug}:`, message);
      }
    }
  }

  // Backfill featuredImageUrl on any legacy posts that are missing one,
  // so every published article ends up with a hero image (required for SEO/social).
  await db.execute(sql`
    UPDATE blog_posts
    SET featured_image_url = ${IMAGES.lease}
    WHERE is_published = true AND featured_image_url IS NULL
  `);

  // Final summary
  const result = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM blog_posts WHERE is_published = true`,
  );
  const rows = result.rows as unknown as PublishedCountRow[] | undefined;
  const publishedCount = rows?.[0]?.n ?? 0;
  console.log(
    `\n✅ Done. Inserted ${inserted}, skipped ${alreadyExisted} (already existed), ${errored} error(s). Total published posts: ${publishedCount}`,
  );

  return { inserted, alreadyExisted, errored, publishedCount };
}

// CLI entrypoint - only run when this file is executed directly, so that
// `seedBlog.ts` (and other callers) can import and chain `seedStateBlogPosts()`
// without triggering a duplicate run / process.exit.
const isCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /seedStateBlogPosts\.(ts|js)$/.test(process.argv[1]);

if (isCli) {
  seedStateBlogPosts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error seeding state blog posts:", error);
      process.exit(1);
    });
}
