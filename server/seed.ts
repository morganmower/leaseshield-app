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
      description: "Professional residential lease agreement with all required state disclosures",
      category: "leasing" as const,
      templateType: "lease" as const,
      stateId: "UT",
      version: 1,
      sortOrder: 1,
      fillableFormData: {
        fields: [
          { id: "landlordName", label: "Landlord Full Name", type: "text", required: true, category: "Landlord Information" },
          { id: "landlordAddress", label: "Landlord Address", type: "text", required: true, category: "Landlord Information" },
          { id: "landlordPhone", label: "Landlord Phone", type: "tel", required: true, category: "Landlord Information" },
          { id: "landlordEmail", label: "Landlord Email", type: "email", required: true, category: "Landlord Information" },
          { id: "tenantName", label: "Tenant Full Name", type: "text", required: true, category: "Tenant Information" },
          { id: "tenantEmail", label: "Tenant Email", type: "email", required: false, category: "Tenant Information" },
          { id: "tenantPhone", label: "Tenant Phone", type: "tel", required: false, category: "Tenant Information" },
          { id: "propertyAddress", label: "Property Address", type: "text", required: true, category: "Property Details" },
          { id: "propertyCity", label: "City", type: "text", required: true, category: "Property Details" },
          { id: "propertyState", label: "State", type: "text", required: true, category: "Property Details", defaultValue: "Utah" },
          { id: "propertyZip", label: "ZIP Code", type: "text", required: true, category: "Property Details" },
          { id: "monthlyRent", label: "Monthly Rent Amount", type: "currency", required: true, category: "Financial Terms" },
          { id: "securityDeposit", label: "Security Deposit", type: "currency", required: true, category: "Financial Terms" },
          { id: "lateFeeDays", label: "Late Fee Grace Period (Days)", type: "number", required: true, category: "Financial Terms", defaultValue: "5" },
          { id: "lateFeeAmount", label: "Late Fee Amount", type: "currency", required: true, category: "Financial Terms" },
          { id: "leaseStartDate", label: "Lease Start Date", type: "date", required: true, category: "Lease Terms" },
          { id: "leaseEndDate", label: "Lease End Date", type: "date", required: true, category: "Lease Terms" },
          { id: "rentDueDay", label: "Rent Due Day of Month", type: "number", required: true, category: "Lease Terms", defaultValue: "1" },
        ]
      },
    },
    {
      title: "Rental Application",
      description: "Comprehensive rental application form compliant with Fair Housing requirements",
      category: "screening" as const,
      templateType: "application" as const,
      stateId: "UT",
      version: 1,
      sortOrder: 2,
      fillableFormData: {
        fields: [
          { id: "applicantName", label: "Full Name", type: "text", required: true, category: "Applicant Information" },
          { id: "applicantPhone", label: "Phone Number", type: "tel", required: true, category: "Applicant Information" },
          { id: "applicantEmail", label: "Email Address", type: "email", required: true, category: "Applicant Information" },
          { id: "currentAddress", label: "Current Address", type: "text", required: true, category: "Applicant Information" },
          { id: "moveInDate", label: "Desired Move-In Date", type: "date", required: true, category: "Applicant Information" },
          { id: "employerName", label: "Employer Name", type: "text", required: true, category: "Employment Information" },
          { id: "employerPhone", label: "Employer Phone", type: "tel", required: true, category: "Employment Information" },
          { id: "monthlyIncome", label: "Monthly Income", type: "currency", required: true, category: "Employment Information" },
          { id: "emergencyContact", label: "Emergency Contact Name", type: "text", required: true, category: "Emergency Contact" },
          { id: "emergencyPhone", label: "Emergency Contact Phone", type: "tel", required: true, category: "Emergency Contact" },
        ]
      },
    },
    {
      title: "Late Rent Notice",
      description: "Formal notice for late rent payment with state-specific requirements",
      category: "notices" as const,
      templateType: "late_rent_notice" as const,
      stateId: "UT",
      version: 1,
      sortOrder: 3,
      fillableFormData: {
        fields: [
          { id: "tenantName", label: "Tenant Full Name", type: "text", required: true, category: "Notice Details" },
          { id: "propertyAddress", label: "Property Address", type: "text", required: true, category: "Notice Details" },
          { id: "rentDueDate", label: "Rent Due Date", type: "date", required: true, category: "Notice Details" },
          { id: "amountDue", label: "Amount Due", type: "currency", required: true, category: "Notice Details" },
          { id: "lateFeeAmount", label: "Late Fee", type: "currency", required: true, category: "Notice Details" },
          { id: "payByDate", label: "Pay By Date", type: "date", required: true, category: "Notice Details" },
          { id: "noticeDate", label: "Notice Date", type: "date", required: true, category: "Notice Details", defaultValue: "today" },
        ]
      },
    },
    {
      title: "Move-In Checklist",
      description: "Detailed move-in inspection checklist to document property condition",
      category: "move_in_out" as const,
      templateType: "move_in_checklist" as const,
      stateId: "UT",
      version: 1,
      sortOrder: 4,
      fillableFormData: {
        fields: [
          { id: "propertyAddress", label: "Property Address", type: "text", required: true, category: "Property Information" },
          { id: "tenantName", label: "Tenant Name", type: "text", required: true, category: "Property Information" },
          { id: "landlordName", label: "Landlord Name", type: "text", required: true, category: "Property Information" },
          { id: "inspectionDate", label: "Inspection Date", type: "date", required: true, category: "Property Information", defaultValue: "today" },
          { id: "moveInDate", label: "Move-In Date", type: "date", required: true, category: "Property Information" },
        ]
      },
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
