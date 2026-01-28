import { db } from "../db";
import { cities, denialCriteria, denialCriteriaRules, denialSentenceTemplates, states } from "@shared/schema";
import { eq } from "drizzle-orm";

const CRITERIA_DATA = [
  // Criminal History
  { code: "CRIM_ARREST", category: "criminal", label: "Arrest (no conviction)", description: "An arrest record without a resulting conviction", sortOrder: 1 },
  { code: "CRIM_CONVICTION_RECENT", category: "criminal", label: "Conviction within last 7 years", description: "A criminal conviction from the past 7 years", sortOrder: 2 },
  { code: "CRIM_CONVICTION_OLD", category: "criminal", label: "Conviction older than 7 years", description: "A criminal conviction more than 7 years ago", sortOrder: 3 },
  { code: "CRIM_SEALED_EXPUNGED", category: "criminal", label: "Sealed or expunged record", description: "A criminal record that has been legally sealed or expunged", sortOrder: 4 },
  { code: "CRIM_FELONY", category: "criminal", label: "Felony conviction", description: "A serious criminal offense classified as a felony", sortOrder: 5 },
  { code: "CRIM_MISDEMEANOR", category: "criminal", label: "Misdemeanor conviction", description: "A less serious criminal offense classified as a misdemeanor", sortOrder: 6 },
  
  // Eviction History
  { code: "EVICT_FILING", category: "eviction", label: "Eviction filing only", description: "An eviction case was filed but no judgment was entered", sortOrder: 10 },
  { code: "EVICT_JUDGMENT", category: "eviction", label: "Eviction judgment", description: "A court-ordered eviction judgment against the tenant", sortOrder: 11 },
  { code: "EVICT_SEALED", category: "eviction", label: "Sealed eviction record", description: "An eviction record that has been legally sealed", sortOrder: 12 },
  
  // Credit History
  { code: "CREDIT_POOR_SCORE", category: "credit", label: "Poor credit score", description: "Credit score below minimum threshold", sortOrder: 20 },
  { code: "CREDIT_COLLECTIONS", category: "credit", label: "Collections accounts", description: "Accounts sent to collections agencies", sortOrder: 21 },
  { code: "CREDIT_HOUSING_DEBT", category: "credit", label: "Housing-related debt", description: "Unpaid rent, utilities, or housing-related debts", sortOrder: 22 },
  { code: "CREDIT_BANKRUPTCY", category: "credit", label: "Bankruptcy", description: "Chapter 7 or Chapter 13 bankruptcy filing", sortOrder: 23 },
  
  // Income
  { code: "INCOME_INSUFFICIENT", category: "income", label: "Income below requirement", description: "Verified income does not meet rent-to-income ratio", sortOrder: 30 },
  { code: "INCOME_UNVERIFIABLE", category: "income", label: "Unable to verify income", description: "Income documentation could not be verified", sortOrder: 31 },
  { code: "INCOME_VOUCHER", category: "income", label: "Uses housing voucher", description: "Applicant receives housing choice voucher (Section 8)", sortOrder: 32 },
  
  // Verification
  { code: "VERIFY_INCOMPLETE", category: "verification", label: "Incomplete application", description: "Required application information was not provided", sortOrder: 40 },
  { code: "VERIFY_FALSE_INFO", category: "verification", label: "False information provided", description: "Applicant provided inaccurate or misleading information", sortOrder: 41 },
  { code: "VERIFY_LANDLORD_REF", category: "verification", label: "Negative landlord reference", description: "Previous landlord provided unfavorable reference", sortOrder: 42 },
] as const;

const CITY_DATA = [
  // Arizona
  { name: "Phoenix", stateId: "AZ" },
  // California
  { name: "Los Angeles", stateId: "CA" },
  { name: "San Francisco", stateId: "CA" },
  { name: "Oakland", stateId: "CA" },
  // Illinois
  { name: "Chicago", stateId: "IL" },
  // Michigan
  { name: "Detroit", stateId: "MI" },
  // Nevada
  { name: "Las Vegas", stateId: "NV" },
  // New Mexico
  { name: "Albuquerque", stateId: "NM" },
  // North Carolina
  { name: "Charlotte", stateId: "NC" },
  // Ohio
  { name: "Columbus", stateId: "OH" },
  { name: "Cleveland", stateId: "OH" },
  // Texas
  { name: "Austin", stateId: "TX" },
  { name: "Dallas", stateId: "TX" },
  { name: "Houston", stateId: "TX" },
  // Utah
  { name: "Salt Lake City", stateId: "UT" },
  // Virginia
  { name: "Richmond", stateId: "VA" },
  { name: "Alexandria", stateId: "VA" },
];

// State-level rules: which criteria are blocked/allowed per state
const STATE_RULES: Record<string, { blocked: string[], conditional: string[], voucher: "blocked" | "allowed" }> = {
  AZ: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "blocked", // Protected since 2023
  },
  CA: {
    blocked: ["CRIM_ARREST", "CRIM_CONVICTION_OLD", "CRIM_SEALED_EXPUNGED", "EVICT_FILING"],
    conditional: ["CRIM_CONVICTION_RECENT", "CRIM_FELONY"], // Requires individualized assessment
    voucher: "blocked",
  },
  FL: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "allowed",
  },
  ID: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "allowed",
  },
  IL: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED", "EVICT_FILING"],
    conditional: ["CRIM_CONVICTION_RECENT", "CRIM_FELONY"], // Requires ban-the-box process
    voucher: "blocked",
  },
  MI: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "allowed",
  },
  NC: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "allowed",
  },
  ND: {
    blocked: ["CRIM_ARREST"],
    conditional: [],
    voucher: "allowed",
  },
  NM: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED", "EVICT_FILING"],
    conditional: [],
    voucher: "blocked",
  },
  NV: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "blocked",
  },
  OH: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "allowed",
  },
  SD: {
    blocked: ["CRIM_ARREST"],
    conditional: [],
    voucher: "allowed",
  },
  TX: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "allowed",
  },
  UT: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "allowed",
  },
  VA: {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED"],
    conditional: [],
    voucher: "blocked",
  },
  WY: {
    blocked: ["CRIM_ARREST"],
    conditional: [],
    voucher: "allowed",
  },
};

// City-level rule overrides
const CITY_RULES: Record<string, { blocked: string[], conditional: string[], notes: string }> = {
  "Los Angeles": {
    blocked: ["CRIM_ARREST", "CRIM_CONVICTION_OLD", "EVICT_FILING"],
    conditional: ["CRIM_CONVICTION_RECENT"],
    notes: "Must review criminal history after application. Must give written reason for denial.",
  },
  "San Francisco": {
    blocked: ["CRIM_ARREST", "CRIM_CONVICTION_OLD", "EVICT_FILING"],
    conditional: ["CRIM_CONVICTION_RECENT"],
    notes: "Criminal screening happens later in process. Must give applicant chance to explain.",
  },
  "Oakland": {
    blocked: ["CRIM_CONVICTION_OLD", "CRIM_SEALED_EXPUNGED", "EVICT_FILING"],
    conditional: ["CRIM_CONVICTION_RECENT"],
    notes: "Must allow applicant to provide context. Denials must be narrowly based on real risk.",
  },
  "Chicago": {
    blocked: ["CRIM_ARREST", "CRIM_SEALED_EXPUNGED", "EVICT_FILING"],
    conditional: ["CRIM_CONVICTION_RECENT"],
    notes: "Criminal review happens after conditional approval. Written explanation required.",
  },
  "Cleveland": {
    blocked: ["CRIM_ARREST", "EVICT_FILING"],
    conditional: [],
    notes: "Follow fair housing rules strictly.",
  },
  "Salt Lake City": {
    blocked: ["CRIM_ARREST"],
    conditional: [],
    notes: "Screening rules must be documented and consistent.",
  },
  "Alexandria": {
    blocked: ["CRIM_ARREST", "EVICT_FILING"],
    conditional: [],
    notes: "Cannot use eviction filings without judgment.",
  },
};

// Pre-approved denial sentences by criteria
const SENTENCE_TEMPLATES: Record<string, string[]> = {
  CRIM_CONVICTION_RECENT: [
    "Based on our written screening criteria, the applicant's recent criminal conviction presents a documented risk to resident safety or property.",
    "The application was denied due to a recent conviction that directly relates to housing safety under our screening standards.",
    "After reviewing the nature and recency of the conviction, we determined it does not meet our safety requirements for this property.",
  ],
  CRIM_FELONY: [
    "Based on our written screening criteria, the applicant's felony conviction presents a documented risk to resident safety or property.",
  ],
  EVICT_JUDGMENT: [
    "The application was denied due to a court-ordered eviction judgment within our approved lookback period.",
    "Our records show a prior eviction judgment that does not meet our rental history requirements.",
    "The application does not meet our criteria due to a recent eviction judgment related to non-payment or lease violation.",
  ],
  CREDIT_POOR_SCORE: [
    "The application was denied because the applicant's credit history does not meet our minimum rental qualification standards.",
    "Based on the consumer report, the applicant does not meet our credit requirements for housing-related obligations.",
  ],
  CREDIT_HOUSING_DEBT: [
    "The application was denied due to a pattern of unpaid housing or utility debt reflected in the credit report.",
  ],
  INCOME_INSUFFICIENT: [
    "The application was denied because verified income does not meet the minimum rent-to-income requirement for this property.",
    "We were unable to verify sufficient income to meet the monthly rental obligation.",
    "The applicant does not meet our income stability requirements based on provided documentation.",
  ],
  INCOME_UNVERIFIABLE: [
    "We were unable to complete screening due to missing or unverifiable income documentation.",
  ],
  VERIFY_INCOMPLETE: [
    "The application was denied because required information could not be verified despite follow-up attempts.",
    "We were unable to complete screening due to missing or unverifiable application information.",
    "The application was denied because submitted documentation could not be confirmed as accurate.",
  ],
  VERIFY_LANDLORD_REF: [
    "The application does not meet our rental history requirements based on previous landlord references.",
  ],
};

// Explanations for blocked criteria
const BLOCKED_EXPLANATIONS: Record<string, { why: string, alternative: string }> = {
  CRIM_ARREST: {
    why: "Arrests without convictions cannot be used as denial criteria. An arrest is not proof of wrongdoing.",
    alternative: "You can only consider convictions, not arrests.",
  },
  CRIM_SEALED_EXPUNGED: {
    why: "Sealed or expunged records have been legally cleared and cannot be used in housing decisions.",
    alternative: "Only consider records that are legally accessible.",
  },
  CRIM_CONVICTION_OLD: {
    why: "Convictions older than 7 years generally cannot be used as the sole basis for denial.",
    alternative: "Focus on more recent history that demonstrates current risk.",
  },
  EVICT_FILING: {
    why: "An eviction filing is not the same as being evicted. Many filings are dismissed or settled.",
    alternative: "Only eviction judgments (where the landlord won in court) can be considered.",
  },
  EVICT_SEALED: {
    why: "Sealed eviction records have been legally cleared and cannot be used.",
    alternative: "Only consider unsealed, accessible eviction judgments.",
  },
  INCOME_VOUCHER: {
    why: "In this jurisdiction, you cannot deny based on someone using a housing voucher or rental assistance.",
    alternative: "You can evaluate whether the tenant's portion of rent meets income requirements.",
  },
};

export async function seedDenialDecisionData() {
  console.log("🌱 Seeding Denial Decision Assistant data...");

  // 1. Seed criteria
  console.log("  → Seeding denial criteria...");
  for (const criteria of CRITERIA_DATA) {
    await db.insert(denialCriteria).values({
      code: criteria.code,
      category: criteria.category as any,
      label: criteria.label,
      description: criteria.description,
      sortOrder: criteria.sortOrder,
      isActive: true,
    }).onConflictDoNothing();
  }

  // 2. Seed cities
  console.log("  → Seeding cities...");
  const cityIdMap: Record<string, string> = {};
  for (const city of CITY_DATA) {
    const existing = await db.select().from(cities).where(eq(cities.name, city.name)).limit(1);
    if (existing.length > 0) {
      cityIdMap[city.name] = existing[0].id;
    } else {
      const result = await db.insert(cities).values({
        name: city.name,
        stateId: city.stateId,
        isActive: true,
      }).returning();
      cityIdMap[city.name] = result[0].id;
    }
  }

  // 3. Get all criteria IDs
  const allCriteria = await db.select().from(denialCriteria);
  const criteriaIdMap: Record<string, string> = {};
  for (const c of allCriteria) {
    criteriaIdMap[c.code] = c.id;
  }

  // 4. Seed state-level rules
  console.log("  → Seeding state-level rules...");
  for (const [stateId, rules] of Object.entries(STATE_RULES)) {
    // Blocked criteria
    for (const code of rules.blocked) {
      if (!criteriaIdMap[code]) continue;
      await db.insert(denialCriteriaRules).values({
        criteriaId: criteriaIdMap[code],
        stateId,
        status: "blocked",
        explanationPlain: BLOCKED_EXPLANATIONS[code]?.why || "Not allowed in this state.",
        legalAlternative: BLOCKED_EXPLANATIONS[code]?.alternative || null,
        version: 1,
      }).onConflictDoNothing();
    }

    // Conditional criteria
    for (const code of rules.conditional) {
      if (!criteriaIdMap[code]) continue;
      await db.insert(denialCriteriaRules).values({
        criteriaId: criteriaIdMap[code],
        stateId,
        status: "conditional",
        explanationPlain: "Requires individualized assessment before denial.",
        requiredSteps: ["individual_assessment"],
        version: 1,
      }).onConflictDoNothing();
    }

    // Voucher rule
    if (rules.voucher === "blocked" && criteriaIdMap["INCOME_VOUCHER"]) {
      await db.insert(denialCriteriaRules).values({
        criteriaId: criteriaIdMap["INCOME_VOUCHER"],
        stateId,
        status: "blocked",
        explanationPlain: BLOCKED_EXPLANATIONS["INCOME_VOUCHER"].why,
        legalAlternative: BLOCKED_EXPLANATIONS["INCOME_VOUCHER"].alternative,
        version: 1,
      }).onConflictDoNothing();
    }
  }

  // 5. Seed city-level rule overrides
  console.log("  → Seeding city-level rules...");
  for (const [cityName, rules] of Object.entries(CITY_RULES)) {
    const cityId = cityIdMap[cityName];
    if (!cityId) continue;

    for (const code of rules.blocked) {
      if (!criteriaIdMap[code]) continue;
      await db.insert(denialCriteriaRules).values({
        criteriaId: criteriaIdMap[code],
        cityId,
        status: "blocked",
        explanationPlain: `${BLOCKED_EXPLANATIONS[code]?.why || "Not allowed in this city."} ${rules.notes}`,
        legalAlternative: BLOCKED_EXPLANATIONS[code]?.alternative || null,
        version: 1,
      }).onConflictDoNothing();
    }

    for (const code of rules.conditional) {
      if (!criteriaIdMap[code]) continue;
      await db.insert(denialCriteriaRules).values({
        criteriaId: criteriaIdMap[code],
        cityId,
        status: "conditional",
        explanationPlain: `Requires individualized assessment. ${rules.notes}`,
        requiredSteps: ["individual_assessment", "written_explanation"],
        version: 1,
      }).onConflictDoNothing();
    }
  }

  // 6. Seed sentence templates
  console.log("  → Seeding sentence templates...");
  for (const [code, sentences] of Object.entries(SENTENCE_TEMPLATES)) {
    const criteriaId = criteriaIdMap[code];
    if (!criteriaId) continue;

    for (let i = 0; i < sentences.length; i++) {
      await db.insert(denialSentenceTemplates).values({
        criteriaId,
        sentenceText: sentences[i],
        isDefault: i === 0,
        isActive: true,
      }).onConflictDoNothing();
    }
  }

  console.log("✅ Denial Decision Assistant data seeded successfully!");
}

// Run if executed directly
if (require.main === module) {
  seedDenialDecisionData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
