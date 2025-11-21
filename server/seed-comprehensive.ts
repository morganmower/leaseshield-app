import { storage } from "./storage";

// Comprehensive template library for all 4 launch states
const comprehensiveTemplates = [
  // UTAH - Leasing
  {
    title: "Utah Residential Lease Agreement",
    description: "Professional 12-month residential lease with all Utah-required disclosures including mold, lead paint, and HOA rules",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Rental Agreement (UT)",
    description: "Flexible month-to-month agreement compliant with Utah termination notice requirements",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 2,
  },
  {
    title: "Lease Renewal Agreement (UT)",
    description: "Streamlined renewal for existing tenants with updated terms and rent adjustments",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 3,
  },

  // UTAH - Screening
  {
    title: "Utah Rental Application Form",
    description: "Comprehensive application collecting employment, rental history, and references while maintaining Fair Housing compliance",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 10,
  },
  {
    title: "Tenant Screening Authorization (UT)",
    description: "FCRA-compliant authorization for background and credit checks",
    category: "screening" as const,
    templateType: "screening_authorization" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 11,
  },
  {
    title: "Adverse Action Notice (UT)",
    description: "Required notice when denying applicant based on screening results",
    category: "screening" as const,
    templateType: "adverse_action" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 12,
  },

  // UTAH - Move In/Out
  {
    title: "Move-In Inspection Checklist (UT)",
    description: "Room-by-room condition documentation protecting your security deposit rights",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Move-Out Inspection Checklist (UT)",
    description: "Final walkthrough form documenting damages and cleaning issues",
    category: "move_in_out" as const,
    templateType: "move_out_checklist" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 21,
  },
  {
    title: "Security Deposit Itemization (UT)",
    description: "Utah-compliant 30-day notice detailing deposit deductions with receipts",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 22,
  },

  // UTAH - Notices
  {
    title: "3-Day Pay or Quit Notice (UT)",
    description: "Utah's required first step for non-payment eviction proceedings",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "5-Day Lease Violation Notice (UT)",
    description: "Notice to cure lease violations before eviction proceedings",
    category: "notices" as const,
    templateType: "lease_violation_notice" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 31,
  },
  {
    title: "30-Day Notice to Vacate (UT)",
    description: "Month-to-month tenancy termination notice",
    category: "notices" as const,
    templateType: "notice_to_vacate" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 32,
  },
  {
    title: "Rent Increase Notice (UT)",
    description: "Proper advance notice for rent increases on month-to-month tenancies",
    category: "notices" as const,
    templateType: "rent_increase" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 33,
  },

  // UTAH - Evictions
  {
    title: "Utah Eviction Complaint",
    description: "Court filing to initiate unlawful detainer proceedings",
    category: "evictions" as const,
    templateType: "eviction_complaint" as const,
    stateId: "UT",
    version: 1,
    sortOrder: 40,
  },

  // TEXAS - Leasing
  {
    title: "Texas Residential Lease Agreement",
    description: "TAA-approved lease with Texas Property Code disclosures including security device, flooding, and mold notices",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "TX",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Rental Agreement (TX)",
    description: "Flexible agreement following Texas termination requirements",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "TX",
    version: 1,
    sortOrder: 2,
  },
  {
    title: "Lease Renewal Agreement (TX)",
    description: "Texas-compliant renewal with updated terms",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "TX",
    version: 1,
    sortOrder: 3,
  },

  // TEXAS - Screening
  {
    title: "Texas Rental Application Form",
    description: "Application compliant with Texas Fair Housing and screening laws",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "TX",
    version: 1,
    sortOrder: 10,
  },
  {
    title: "Tenant Screening Authorization (TX)",
    description: "FCRA-compliant credit and background check authorization",
    category: "screening" as const,
    templateType: "screening_authorization" as const,
    stateId: "TX",
    version: 1,
    sortOrder: 11,
  },

  // TEXAS - Move In/Out
  {
    title: "Move-In Inspection Checklist (TX)",
    description: "Detailed condition report for Texas properties",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "TX",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Security Deposit Itemization (TX)",
    description: "Texas 30-day itemized deduction notice with required documentation",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "TX",
    version: 1,
    sortOrder: 21,
  },

  // TEXAS - Notices
  {
    title: "3-Day Notice to Vacate (TX)",
    description: "Texas Property Code-compliant notice for non-payment",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "TX",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "30-Day Notice to Vacate (TX)",
    description: "Month-to-month termination notice per Texas law",
    category: "notices" as const,
    templateType: "notice_to_vacate" as const,
    stateId: "TX",
    version: 1,
    sortOrder: 31,
  },

  // NORTH DAKOTA - Leasing
  {
    title: "North Dakota Residential Lease",
    description: "ND Century Code-compliant lease with required state disclosures",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "ND",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Agreement (ND)",
    description: "Flexible tenancy following ND termination requirements",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "ND",
    version: 1,
    sortOrder: 2,
  },

  // NORTH DAKOTA - Screening
  {
    title: "North Dakota Rental Application",
    description: "Comprehensive screening application for ND properties",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "ND",
    version: 1,
    sortOrder: 10,
  },

  // NORTH DAKOTA - Move In/Out
  {
    title: "Move-In Checklist (ND)",
    description: "Property condition documentation for North Dakota rentals",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "ND",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Security Deposit Statement (ND)",
    description: "ND's required 30-day itemized deduction notice",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "ND",
    version: 1,
    sortOrder: 21,
  },

  // NORTH DAKOTA - Notices
  {
    title: "3-Day Demand for Rent (ND)",
    description: "North Dakota's notice for overdue rent before eviction",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "ND",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "30-Day Notice to Terminate (ND)",
    description: "Month-to-month termination per ND Century Code",
    category: "notices" as const,
    templateType: "notice_to_vacate" as const,
    stateId: "ND",
    version: 1,
    sortOrder: 31,
  },

  // SOUTH DAKOTA - Leasing
  {
    title: "South Dakota Residential Lease",
    description: "SD Codified Laws-compliant residential lease agreement",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "SD",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Agreement (SD)",
    description: "Flexible rental agreement for South Dakota properties",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "SD",
    version: 1,
    sortOrder: 2,
  },

  // SOUTH DAKOTA - Screening
  {
    title: "South Dakota Rental Application",
    description: "Fair Housing-compliant application for SD landlords",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "SD",
    version: 1,
    sortOrder: 10,
  },

  // SOUTH DAKOTA - Move In/Out
  {
    title: "Move-In Inspection Form (SD)",
    description: "Property condition checklist for South Dakota rentals",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "SD",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Security Deposit Accounting (SD)",
    description: "SD's 14-day or 45-day deduction itemization notice",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "SD",
    version: 1,
    sortOrder: 21,
  },

  // SOUTH DAKOTA - Notices
  {
    title: "3-Day Notice for Non-Payment (SD)",
    description: "South Dakota's required rent demand notice",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "SD",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "30-Day Termination Notice (SD)",
    description: "Month-to-month tenancy termination per SD law",
    category: "notices" as const,
    templateType: "notice_to_vacate" as const,
    stateId: "SD",
    version: 1,
    sortOrder: 31,
  },
];

async function seedComprehensiveTemplates() {
  console.log(`🌱 Seeding ${comprehensiveTemplates.length} comprehensive templates...`);
  
  let created = 0;
  let skipped = 0;

  for (const template of comprehensiveTemplates) {
    try {
      await storage.createTemplate(template);
      console.log(`  ✓ ${template.title} (${template.stateId})`);
      created++;
    } catch (error) {
      skipped++;
    }
  }

  console.log(`\n✅ Templates seeded: ${created} created, ${skipped} already existed`);
}

// Run if executed directly
seedComprehensiveTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Template seeding failed:", error);
    process.exit(1);
  });
