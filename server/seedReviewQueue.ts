import { storage } from "./storage";

async function seedReviewQueue() {
  console.log("🌱 Seeding template review queue with sample data...");

  try {
    // Get a template to flag for review
    const templates = await storage.getAllTemplates({ stateId: "UT" });
    console.log(`Found ${templates.length} Utah templates`);
    
    const utahLease = templates.find(t => t.category === "leasing");

    if (!utahLease) {
      console.log("⚠️  No Utah lease template found. Run the main seed script first.");
      return;
    }

    // Create sample review queue items
    const sampleReviews = [
      {
        templateId: utahLease.id,
        priority: 3, // high priority
        status: "pending" as const,
        reason: "Utah HB 123 extends the security deposit return timeline from 30 to 45 days and requires itemized deductions to be sent via certified mail. This directly affects the security deposit section of residential lease agreements.",
        recommendedChanges: "Updated security deposit return clause in Section 4.2 to reflect new 45-day timeline. Added certified mail requirement for itemized deduction notices.",
      },
      {
        templateId: utahLease.id,
        priority: 2, // medium priority
        status: "pending" as const,
        reason: "Utah SB 87 clarifies landlord entry requirements for emergency repairs. Templates should specify that 24-hour notice is not required for genuine emergencies involving safety or property damage.",
        recommendedChanges: "Added emergency exception clause to Section 7.1 (Landlord Entry Rights) to align with SB 87 clarifications.",
      },
    ];

    for (const review of sampleReviews) {
      await storage.createTemplateReviewQueue(review);
      console.log(`✅ Created review for: ${utahLease.title}`);
    }

    console.log("🎉 Sample review queue data seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding review queue:", error);
  }
}

seedReviewQueue()
  .then(() => {
    console.log("✅ Seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
