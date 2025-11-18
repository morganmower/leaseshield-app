import { storage } from "./storage";

async function seedDatabase() {
  console.log("🌱 Starting database seed...");

  // Seed states
  console.log("Creating states...");
  const statesToCreate = [
    { id: "UT", name: "Utah", description: "State-specific templates and compliance for Utah landlords" },
    { id: "TX", name: "Texas", description: "State-specific templates and compliance for Texas landlords" },
    { id: "ND", name: "North Dakota", description: "State-specific templates and compliance for North Dakota landlords" },
    { id: "SD", name: "South Dakota", description: "State-specific templates and compliance for South Dakota landlords" },
  ];

  for (const state of statesToCreate) {
    const existing = await storage.getState(state.id);
    if (!existing) {
      await storage.createState(state);
      console.log(`  ✓ Created state: ${state.name}`);
    }
  }

  // Seed sample templates for each state
  console.log("\nCreating sample templates...");
  const templateSamples = [
    {
      title: "Residential Lease Agreement",
      description: "Attorney-reviewed residential lease agreement with all required state disclosures",
      category: "leasing" as const,
      templateType: "lease" as const,
      stateId: "UT",
      version: 1,
      sortOrder: 1,
    },
    {
      title: "Rental Application",
      description: "Comprehensive rental application form compliant with Fair Housing requirements",
      category: "screening" as const,
      templateType: "application" as const,
      stateId: "UT",
      version: 1,
      sortOrder: 2,
    },
    {
      title: "Late Rent Notice",
      description: "Formal notice for late rent payment with state-specific requirements",
      category: "notices" as const,
      templateType: "late_rent_notice" as const,
      stateId: "UT",
      version: 1,
      sortOrder: 3,
    },
    {
      title: "Move-In Checklist",
      description: "Detailed move-in inspection checklist to document property condition",
      category: "move_in_out" as const,
      templateType: "move_in_checklist" as const,
      stateId: "UT",
      version: 1,
      sortOrder: 4,
    },
  ];

  for (const template of templateSamples) {
    try {
      await storage.createTemplate(template);
      console.log(`  ✓ Created template: ${template.title} (${template.stateId})`);
    } catch (error) {
      console.log(`  ⚠ Template may already exist: ${template.title}`);
    }
  }

  // Seed sample legal update
  console.log("\nCreating sample legal update...");
  try {
    await storage.createLegalUpdate({
      stateId: "UT",
      title: "New Security Deposit Disclosure Requirements",
      summary: "Utah now requires landlords to provide specific written notice about security deposit deductions within 30 days of move-out.",
      whyItMatters: "Failure to provide timely notice can result in forfeiting your right to make deductions and potential penalties.",
      beforeText: "Landlords could deduct from security deposits and provide notice within a reasonable timeframe.",
      afterText: "Landlords must provide itemized deduction notice within 30 days of move-out or forfeit deduction rights.",
      effectiveDate: new Date("2024-01-01"),
      impactLevel: "high",
    });
    console.log("  ✓ Created sample legal update");
  } catch (error) {
    console.log("  ⚠ Legal update may already exist");
  }

  // Seed sample compliance card
  console.log("\nCreating sample compliance card...");
  try {
    await storage.createComplianceCard({
      stateId: "UT",
      title: "Required Lease Disclosures",
      summary: "Utah requires specific disclosures in all residential lease agreements",
      category: "disclosures",
      content: {
        sections: [
          {
            title: "Lead-Based Paint Disclosure",
            content: "Required for properties built before 1978",
          },
          {
            title: "Mold Disclosure",
            content: "Landlords must disclose known mold issues",
          },
          {
            title: "Security Deposit Terms",
            content: "Must specify conditions for deposit deductions",
          },
        ],
      },
      sortOrder: 1,
    });
    console.log("  ✓ Created sample compliance card");
  } catch (error) {
    console.log("  ⚠ Compliance card may already exist");
  }

  console.log("\n✅ Database seed completed!");
}

export { seedDatabase };

// Run seed if this file is executed directly
seedDatabase()
  .then(() => {
    console.log("\n👍 You can now start the application");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
