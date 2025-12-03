import { storage } from "./storage";

// Comprehensive legal updates for all 4 launch states
const legalUpdates = [
  // UTAH Legal Updates
  {
    stateId: "UT",
    title: "New Security Deposit Disclosure Requirements",
    summary: "Utah now requires landlords to provide specific written notice about security deposit deductions within 30 days of move-out.",
    whyItMatters: "Failure to provide timely itemized notice can result in forfeiting your right to make ANY deductions, even for legitimate damages. You could lose thousands in valid claims.",
    beforeText: "Landlords could deduct from security deposits and provide notice within a reasonable timeframe. The law was vague on specific deadlines.",
    afterText: "Landlords MUST provide itemized deduction notice within 30 days of move-out or forfeit ALL deduction rights, including for documented damages.",
    effectiveDate: new Date("2024-01-01"),
    impactLevel: "high",
  },
  {
    stateId: "UT",
    title: "Mold Disclosure Addendum Now Mandatory",
    summary: "All residential leases in Utah must include the state-approved mold prevention and remediation addendum.",
    whyItMatters: "Failure to include this addendum can expose you to liability for mold-related health claims and reduce your ability to hold tenants responsible for mold caused by their actions.",
    beforeText: "Mold disclosures were recommended but not legally required in lease agreements.",
    afterText: "The Utah mold addendum is now mandatory for all residential leases, explaining tenant responsibilities for preventing moisture and reporting mold issues promptly.",
    effectiveDate: new Date("2023-07-01"),
    impactLevel: "high",
  },
  {
    stateId: "UT",
    title: "Service Animal Documentation Rights",
    summary: "Utah clarified landlords' rights to request verification for emotional support animals under Fair Housing Act.",
    whyItMatters: "This protects you from fraudulent ESA claims while ensuring legitimate service animal accommodations are properly granted.",
    beforeText: "Landlords were unsure what documentation they could legally request for emotional support animals.",
    afterText: "Landlords can now request documentation from a licensed healthcare provider with an established relationship (30+ days) with the tenant. Online ESA letter mills can be rejected.",
    effectiveDate: new Date("2023-03-15"),
    impactLevel: "medium",
  },

  // TEXAS Legal Updates
  {
    stateId: "TX",
    title: "Flooding Disclosure Expanded",
    summary: "Texas Property Code now requires disclosure of any flooding events in the past 5 years, not just major floods.",
    whyItMatters: "Failure to disclose flooding history can result in lease termination rights for tenants and potential fraud claims against you.",
    beforeText: "Landlords only had to disclose FEMA-declared flood events or flooding that caused substantial damage.",
    afterText: "ANY flooding in past 5 years must be disclosed, including minor basement seepage, regardless of insurance claims or official disaster declarations.",
    effectiveDate: new Date("2024-09-01"),
    impactLevel: "high",
  },
  {
    stateId: "TX",
    title: "Smoke Alarm Self-Certification Required",
    summary: "Texas landlords must now provide written certification of smoke alarm compliance at lease signing.",
    whyItMatters: "This simple compliance step protects you from liability in fire-related incidents and demonstrates due diligence.",
    beforeText: "Smoke alarms were required but no written certification was mandated.",
    afterText: "Lease must include landlord's written statement certifying smoke alarms are installed and functional per local fire code at move-in.",
    effectiveDate: new Date("2023-09-01"),
    impactLevel: "medium",
  },
  {
    stateId: "TX",
    title: "Security Deposit Bad Faith Penalties Increased",
    summary: "Texas courts can now award up to 3x security deposit amount plus $100 and attorney fees for bad faith withholding.",
    whyItMatters: "Improper deposit handling can turn a $1,500 dispute into a $4,600+ judgment against you. Document everything and return deposits on time.",
    beforeText: "Courts could award actual damages plus attorney fees for improper deposit retention.",
    afterText: "Landlords acting in bad faith face treble damages (3x deposit) plus $100 statutory penalty and tenant's attorney fees—potentially tens of thousands in penalties.",
    effectiveDate: new Date("2023-06-15"),
    impactLevel: "high",
  },

  // NORTH DAKOTA Legal Updates
  {
    stateId: "ND",
    title: "Security Deposit Interest Requirement Clarified",
    summary: "North Dakota clarified that security deposits do not require interest payments unless specified in lease.",
    whyItMatters: "This eliminates uncertainty about deposit interest obligations in ND—you are NOT required to pay interest unless you voluntarily agree to it in the lease.",
    beforeText: "Some tenants claimed ND law required security deposit interest payments, creating confusion.",
    afterText: "ND Century Code confirms NO interest requirement on security deposits unless landlord voluntarily promises it in the written lease agreement.",
    effectiveDate: new Date("2023-07-01"),
    impactLevel: "low",
  },
  {
    stateId: "ND",
    title: "30-Day Notice Requirement for Rent Increases",
    summary: "North Dakota now requires 30-day advance written notice for rent increases on month-to-month tenancies.",
    whyItMatters: "Verbal notices or shorter notice periods are no longer valid. Ensure proper written notice to avoid disputes and potential court losses.",
    beforeText: "Rent increase notice requirements were not clearly specified in ND law for month-to-month tenancies.",
    afterText: "Landlords must provide 30-day written notice before increasing rent on month-to-month leases. Notice period starts when delivered to tenant.",
    effectiveDate: new Date("2024-01-01"),
    impactLevel: "medium",
  },

  // SOUTH DAKOTA Legal Updates
  {
    stateId: "SD",
    title: "Security Deposit Return Timeline Simplified",
    summary: "South Dakota clarified the two-tier deposit return system: 14 days for full refund, 45 days if making deductions.",
    whyItMatters: "Understanding these timelines protects you from penalties and ensures you have adequate time to assess damages and obtain repair estimates.",
    beforeText: "The law mentioned both 14-day and 45-day timelines but wasn't clear about when each applied.",
    afterText: "Use 14-day timeline for full refunds (no itemization needed). Use 45-day timeline if making ANY deductions (requires itemized list). Choose wisely—missing deadlines forfeits deduction rights.",
    effectiveDate: new Date("2023-07-01"),
    impactLevel: "medium",
  },
  {
    stateId: "SD",
    title: "Landlord-Tenant Act Notice Requirements",
    summary: "South Dakota codified proper service methods for eviction and termination notices.",
    whyItMatters: "Improper notice service can invalidate your eviction case, costing you months of lost rent and legal fees. Follow these methods exactly.",
    beforeText: "Notice service methods were based on court interpretations and varied by county.",
    afterText: "Notices must be served via: (1) personal delivery with witness, (2) certified mail with return receipt, or (3) posting on main entrance AND mailing via first-class mail. Document everything.",
    effectiveDate: new Date("2024-01-01"),
    impactLevel: "high",
  },

  // WYOMING Legal Updates
  {
    stateId: "WY",
    title: "Methamphetamine Contamination Disclosure",
    summary: "Wyoming now requires disclosure of any prior meth contamination in rental properties.",
    whyItMatters: "Failure to disclose meth contamination history can expose you to significant liability and potential criminal charges.",
    beforeText: "No specific requirement to disclose prior methamphetamine contamination.",
    afterText: "Landlords must disclose in writing if property was previously used for meth production, even if remediated.",
    effectiveDate: new Date("2024-01-01"),
    impactLevel: "high",
  },
  {
    stateId: "WY",
    title: "Security Deposit Return Clarification",
    summary: "Wyoming clarified the 30-day deposit return timeline and itemization requirements.",
    whyItMatters: "Clear understanding of deadlines prevents costly disputes and potential lawsuits over deposit handling.",
    beforeText: "Return timeline was referenced in statute but procedures were not clearly outlined.",
    afterText: "Landlords must return deposit OR provide written itemization within 30 days. Itemization must include specific damages and costs.",
    effectiveDate: new Date("2023-07-01"),
    impactLevel: "medium",
  },

  // CALIFORNIA Legal Updates
  {
    stateId: "CA",
    title: "AB 1482 Tenant Protection Act Updates",
    summary: "California expanded statewide rent cap and just cause eviction protections.",
    whyItMatters: "Violating rent cap limits can result in tenant lawsuits and penalties. Understanding exemptions is critical.",
    beforeText: "Rent caps and just cause protections applied to most multi-family and corporate-owned properties.",
    afterText: "Rent increases capped at 5% + CPI (max 10%). Just cause required for tenants after 12 months. Exemptions narrowed for newer properties.",
    effectiveDate: new Date("2024-01-01"),
    impactLevel: "high",
  },
  {
    stateId: "CA",
    title: "Security Deposit Limit Reduction",
    summary: "California reduced security deposit limits for most landlords starting July 2024.",
    whyItMatters: "Collecting deposits above the new limits exposes you to legal action and penalties.",
    beforeText: "Maximum 2 months rent for unfurnished, 3 months for furnished properties.",
    afterText: "For landlords with 4+ properties: Maximum 1 month rent regardless of furnished status. Small landlords (1-2 properties) retain prior limits until 2025.",
    effectiveDate: new Date("2024-07-01"),
    impactLevel: "high",
  },
  {
    stateId: "CA",
    title: "Bed Bug Disclosure Requirements",
    summary: "California requires written bed bug disclosure and informational materials at lease signing.",
    whyItMatters: "Failure to provide required disclosures can void portions of your lease and expose you to liability.",
    beforeText: "Bed bug disclosures were recommended but specific requirements varied.",
    afterText: "Must provide written disclosure of known infestations AND bed bug informational materials to all new tenants.",
    effectiveDate: new Date("2023-01-01"),
    impactLevel: "medium",
  },

  // VIRGINIA Legal Updates
  {
    stateId: "VA",
    title: "Move-In Inspection Report Mandate",
    summary: "Virginia now requires landlords to provide written move-in inspection reports within 5 days.",
    whyItMatters: "Missing this deadline weakens your ability to make security deposit deductions for pre-existing damage.",
    beforeText: "Move-in inspections were recommended but not strictly mandated with specific timelines.",
    afterText: "Written move-in inspection report must be provided to tenant within 5 days of occupancy. Tenant has 5 days to respond with objections.",
    effectiveDate: new Date("2024-01-01"),
    impactLevel: "high",
  },
  {
    stateId: "VA",
    title: "45-Day Security Deposit Return",
    summary: "Virginia codified the 45-day deposit return requirement with specific itemization standards.",
    whyItMatters: "Late returns or improper itemization can result in losing your right to any deductions.",
    beforeText: "Deposit return timelines existed but itemization requirements were less specific.",
    afterText: "Return deposit within 45 days with itemized list. Must include actual costs for each deduction. Failure forfeits deduction rights.",
    effectiveDate: new Date("2023-07-01"),
    impactLevel: "medium",
  },

  // NEVADA Legal Updates
  {
    stateId: "NV",
    title: "7-Day Pay or Quit Notice Process",
    summary: "Nevada clarified that 7-day notices must be served through constable or sheriff.",
    whyItMatters: "Improper service invalidates your eviction—potentially costing months of lost rent and restart fees.",
    beforeText: "Notice service methods varied and landlords sometimes attempted personal service.",
    afterText: "7-day pay or quit notices MUST be served through constable or sheriff. Self-service or mail service is not valid for this notice type.",
    effectiveDate: new Date("2024-01-01"),
    impactLevel: "high",
  },
  {
    stateId: "NV",
    title: "Foreclosure Disclosure Requirement",
    summary: "Nevada requires landlords to disclose if property is in foreclosure before lease signing.",
    whyItMatters: "Failure to disclose can result in lease termination rights for tenants and potential fraud claims.",
    beforeText: "Foreclosure disclosure requirements were limited to certain circumstances.",
    afterText: "Landlords must provide written disclosure if property is in foreclosure proceedings before executing any new lease.",
    effectiveDate: new Date("2023-07-01"),
    impactLevel: "medium",
  },

  // ARIZONA Legal Updates
  {
    stateId: "AZ",
    title: "14-Business-Day Deposit Return",
    summary: "Arizona clarified the 14-business-day deposit return requirement under ARLTA.",
    whyItMatters: "Missing this deadline forfeits your right to make deductions and can result in penalties.",
    beforeText: "14-day timeline existed but calculation of business days was sometimes disputed.",
    afterText: "Return deposit or provide itemized statement within 14 BUSINESS days (excludes weekends and holidays) of move-out and key return.",
    effectiveDate: new Date("2024-01-01"),
    impactLevel: "high",
  },
  {
    stateId: "AZ",
    title: "Pool Safety Notice Requirements",
    summary: "Arizona expanded pool safety disclosure requirements for rental properties.",
    whyItMatters: "Properties with pools face additional liability—proper disclosures provide crucial protection.",
    beforeText: "Pool safety notices were required but specific content was not mandated.",
    afterText: "Must provide detailed pool safety notice per A.R.S. § 36-1681 including drowning prevention information and barrier requirements.",
    effectiveDate: new Date("2023-07-01"),
    impactLevel: "medium",
  },

  // FLORIDA Legal Updates
  {
    stateId: "FL",
    title: "Radon Gas Disclosure Mandate",
    summary: "Florida requires specific statutory radon disclosure language in all residential leases.",
    whyItMatters: "Using non-compliant disclosure language can expose you to liability for tenant health claims.",
    beforeText: "Radon disclosures were recommended but exact language requirements varied.",
    afterText: "Must include EXACT statutory language from F.S. § 404.056 in every residential lease. Paraphrasing or omitting is not compliant.",
    effectiveDate: new Date("2023-01-01"),
    impactLevel: "medium",
  },
  {
    stateId: "FL",
    title: "Security Deposit Notice Timeline",
    summary: "Florida clarified the 15/30-day deposit return framework with certified mail requirements.",
    whyItMatters: "Improper notice procedure forfeits ALL deduction rights—even for legitimate damages.",
    beforeText: "Return timelines existed but certified mail requirements were sometimes overlooked.",
    afterText: "15 days if no deductions; 30 days if claiming deductions. Deduction notice MUST be sent via certified mail to preserve rights.",
    effectiveDate: new Date("2024-01-01"),
    impactLevel: "high",
  },
];

async function seedLegalUpdates() {
  console.log(`🌱 Seeding ${legalUpdates.length} legal updates...`);
  
  let created = 0;
  let skipped = 0;

  for (const update of legalUpdates) {
    try {
      await storage.createLegalUpdate(update);
      console.log(`  ✓ ${update.title} (${update.stateId})`);
      created++;
    } catch (error) {
      skipped++;
    }
  }

  console.log(`\n✅ Legal updates seeded: ${created} created, ${skipped} already existed`);
}

// Run if executed directly
seedLegalUpdates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Legal update seeding failed:", error);
    process.exit(1);
  });
