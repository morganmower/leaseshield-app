import { storage } from "./storage";

// Comprehensive compliance cards for all 4 launch states
const comprehensiveComplianceCards = [
  // UTAH Compliance Cards
  {
    stateId: "UT",
    title: "Required Lease Disclosures",
    summary: "Utah requires specific written disclosures in all residential lease agreements to protect both landlords and tenants",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Lead-Based Paint Disclosure",
          content: "Required for properties built before 1978. Must provide EPA-approved pamphlet and disclosure form before lease signing.",
        },
        {
          title: "Mold Disclosure",
          content: "Landlords must disclose known mold issues and provide Utah's standard mold addendum explaining tenant responsibilities for preventing moisture.",
        },
        {
          title: "Security Deposit Terms",
          content: "Lease must specify deposit amount, conditions for deductions, and 30-day timeframe for itemized refund after move-out.",
        },
        {
          title: "HOA Rules (if applicable)",
          content: "If property is in an HOA, tenants must receive a copy of CC&Rs and community rules before signing the lease.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "UT",
    title: "Security Deposit Return Timeline",
    summary: "Utah law strictly governs how and when security deposits must be returned to tenants",
    category: "deposits",
    content: {
      sections: [
        {
          title: "30-Day Deadline",
          content: "Landlords must return deposits or provide itemized deduction list within 30 days of tenant move-out.",
        },
        {
          title: "Required Documentation",
          content: "Deductions must be itemized with supporting receipts for repairs exceeding $200. Photos of damages are highly recommended.",
        },
        {
          title: "Forfeiture Risk",
          content: "Missing the 30-day deadline can result in forfeiting ALL deduction rights, even for legitimate damages.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "UT",
    title: "Eviction Notice Requirements",
    summary: "Utah has specific notice periods and requirements before filing eviction proceedings",
    category: "evictions",
    content: {
      sections: [
        {
          title: "3-Day Pay or Quit (Non-Payment)",
          content: "For unpaid rent, serve 3-day written notice. Tenant can cure by paying in full within 3 days to avoid eviction.",
        },
        {
          title: "5-Day Cure or Quit (Lease Violations)",
          content: "For lease violations (unauthorized pets, noise, etc.), give 5 days to cure the violation before proceeding.",
        },
        {
          title: "No Verbal Notices",
          content: "All eviction notices MUST be in writing and properly served via personal delivery, posting, or certified mail.",
        },
      ],
    },
    sortOrder: 3,
  },

  // TEXAS Compliance Cards
  {
    stateId: "TX",
    title: "Required Property Disclosures",
    summary: "Texas Property Code mandates specific disclosures before lease signing to protect tenants",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Security Device Notice",
          content: "Must disclose if property lacks security devices (deadbolts, window latches, etc.) required by local ordinance.",
        },
        {
          title: "Flooding History",
          content: "Landlords must disclose if property has flooded in past 5 years or is in a 100-year floodplain.",
        },
        {
          title: "Mold Remediation Rights",
          content: "Lease must include notice of tenant's rights under Texas Mold provisions including repair request procedures.",
        },
        {
          title: "Smoke Alarm Compliance",
          content: "Must certify smoke alarms are installed per local fire code at lease signing.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "TX",
    title: "Security Deposit Limits & Return",
    summary: "Texas strictly regulates security deposit handling with penalties for non-compliance",
    category: "deposits",
    content: {
      sections: [
        {
          title: "No State Limit on Amount",
          content: "Texas does not cap deposit amounts, but market competition typically keeps them at 1-2 months' rent.",
        },
        {
          title: "30-Day Return Requirement",
          content: "Deposits must be refunded with itemized deductions within 30 days of move-out. Missing this deadline triggers penalties.",
        },
        {
          title: "Bad Faith Penalties",
          content: "Landlords acting in bad faith (withholding deposits improperly) can owe 3x deposit amount plus $100 and attorney fees.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "TX",
    title: "Eviction Notice Timeline",
    summary: "Texas has streamlined eviction procedures but requires strict adherence to notice requirements",
    category: "evictions",
    content: {
      sections: [
        {
          title: "3-Day Notice to Vacate",
          content: "For non-payment, serve 3-day written notice. No grace period required unless specified in lease.",
        },
        {
          title: "Notice Must Be Proper",
          content: "Notice must state specific reason for eviction and comply with Texas Property Code format requirements.",
        },
        {
          title: "Fast Court Process",
          content: "Texas evictions move quickly—often 2-3 weeks from filing to writ of possession if tenant doesn't respond.",
        },
      ],
    },
    sortOrder: 3,
  },

  // NORTH DAKOTA Compliance Cards
  {
    stateId: "ND",
    title: "Landlord Disclosure Requirements",
    summary: "North Dakota Century Code requires specific lease disclosures and landlord contact information",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Owner/Agent Contact Info",
          content: "Lease must include name and address of property owner or authorized management agent for legal notices.",
        },
        {
          title: "Security Deposit Terms",
          content: "Lease must specify deposit amount, allowable deductions, and 30-day return timeline.",
        },
        {
          title: "Lead-Based Paint (Pre-1978)",
          content: "Federal requirement for older properties—must provide EPA pamphlet and disclosure form.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "ND",
    title: "Security Deposit Handling",
    summary: "North Dakota law governs deposit returns with specific documentation requirements",
    category: "deposits",
    content: {
      sections: [
        {
          title: "30-Day Return Deadline",
          content: "Landlords must return deposits or provide itemized list of deductions within 30 days of tenant move-out.",
        },
        {
          title: "Required Itemization",
          content: "Deductions must list specific damages, repair costs, and date of work completion.",
        },
        {
          title: "Normal Wear vs Damage",
          content: "Cannot deduct for normal wear and tear (faded paint, carpet wear from walking, etc.). Only actual damages are deductible.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "ND",
    title: "Eviction Notice Requirements",
    summary: "North Dakota Century Code specifies notice periods based on tenancy type and violation",
    category: "evictions",
    content: {
      sections: [
        {
          title: "3-Day Demand for Rent",
          content: "For unpaid rent, serve written 3-day notice demanding payment before filing eviction.",
        },
        {
          title: "30-Day Notice (Month-to-Month)",
          content: "To terminate month-to-month tenancies without cause, either party must give 30-day written notice.",
        },
        {
          title: "Proper Service Required",
          content: "Notices must be served via personal delivery, posting on door, or certified mail per ND law.",
        },
      ],
    },
    sortOrder: 3,
  },

  // SOUTH DAKOTA Compliance Cards
  {
    stateId: "SD",
    title: "Required Lease Disclosures",
    summary: "South Dakota Codified Laws mandate specific disclosures and lease terms",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Owner/Manager Contact",
          content: "Lease must identify property owner or authorized agent for receiving legal notices and maintenance requests.",
        },
        {
          title: "Security Deposit Terms",
          content: "Lease must state deposit amount and explain 14-day or 45-day return timeline options.",
        },
        {
          title: "Lead-Based Paint Disclosure",
          content: "Required for pre-1978 properties—provide EPA pamphlet and signed disclosure form.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "SD",
    title: "Security Deposit Return Rules",
    summary: "South Dakota offers two timeframes for deposit returns with different requirements",
    category: "deposits",
    content: {
      sections: [
        {
          title: "14-Day Quick Return",
          content: "Return full deposit within 14 days with no itemization required—cleanest option for undamaged units.",
        },
        {
          title: "45-Day Itemized Return",
          content: "If making deductions, landlords have 45 days to return deposit with itemized list of damages and repair costs.",
        },
        {
          title: "Choosing Your Timeline",
          content: "Most landlords use the 45-day window to thoroughly assess damages and obtain repair estimates.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "SD",
    title: "Eviction Notice Timeline",
    summary: "South Dakota Codified Laws specify notice requirements before eviction proceedings",
    category: "evictions",
    content: {
      sections: [
        {
          title: "3-Day Notice (Non-Payment)",
          content: "For unpaid rent, serve 3-day written notice before filing eviction complaint.",
        },
        {
          title: "30-Day Termination Notice",
          content: "For month-to-month tenancies, either party can terminate with 30-day written notice.",
        },
        {
          title: "Proper Written Notice",
          content: "All notices must be in writing and properly served—verbal notices have no legal standing.",
        },
      ],
    },
    sortOrder: 3,
  },
];

async function seedComplianceCards() {
  console.log(`🌱 Seeding ${comprehensiveComplianceCards.length} compliance cards...`);
  
  let created = 0;
  let skipped = 0;

  for (const card of comprehensiveComplianceCards) {
    try {
      await storage.createComplianceCard(card);
      console.log(`  ✓ ${card.title} (${card.stateId})`);
      created++;
    } catch (error) {
      skipped++;
    }
  }

  console.log(`\n✅ Compliance cards seeded: ${created} created, ${skipped} already existed`);
}

// Run if executed directly
seedComplianceCards()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Compliance card seeding failed:", error);
    process.exit(1);
  });
