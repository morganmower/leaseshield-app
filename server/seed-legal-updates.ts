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
