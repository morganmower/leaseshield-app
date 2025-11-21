import { db } from "./db";
import { blogPosts } from "@shared/schema";

async function seedBlogPosts() {
  console.log("Seeding blog posts...");

  const posts = [
    {
      title: "7 Legal Mistakes Utah Landlords Make (And How to Avoid Them)",
      slug: "utah-landlord-legal-mistakes",
      excerpt: "From security deposit violations to improper eviction notices, learn the most common legal pitfalls Utah landlords face and how to protect yourself.",
      content: `
        <h2>Introduction</h2>
        <p>As a Utah landlord, navigating the complex web of state and federal housing laws can feel overwhelming. But making legal mistakes isn't just stressful—it can cost you thousands of dollars in fines, legal fees, and lost rental income.</p>
        
        <p>In this guide, we'll walk through the seven most common legal mistakes Utah landlords make and show you exactly how to avoid them.</p>

        <h2>1. Violating Security Deposit Laws</h2>
        <p>Utah law requires landlords to return security deposits within 30 days after move-out, along with an itemized list of any deductions. Many landlords miss this deadline or fail to provide proper documentation.</p>
        
        <p><strong>The Risk:</strong> You could be liable for triple damages plus attorney's fees if you wrongfully withhold a deposit.</p>
        
        <p><strong>How to Avoid It:</strong> Set up a system to inspect units immediately after move-out, document everything with photos, and send the deposit return within the legal timeframe. Use our Move-Out Inspection Checklist to stay organized.</p>

        <h2>2. Using Non-Compliant Lease Agreements</h2>
        <p>Generic lease templates from the internet often don't comply with Utah's specific requirements, leaving you vulnerable to legal challenges.</p>
        
        <p><strong>The Risk:</strong> An unenforceable lease could prevent you from collecting rent or evicting problem tenants.</p>
        
        <p><strong>How to Avoid It:</strong> Use professional, Utah-specific lease agreements that include all required disclosures and comply with current state law.</p>

        <h2>3. Improper Eviction Procedures</h2>
        <p>Utah requires specific notice periods and procedures for different types of evictions. Skipping steps or using the wrong form can void your entire eviction.</p>
        
        <p><strong>The Risk:</strong> Your eviction case gets dismissed, and you have to start over—losing months of rent.</p>
        
        <p><strong>How to Avoid It:</strong> Follow the exact process: serve proper notice, file the correct court forms, and document everything. Our Utah Eviction Guide provides step-by-step instructions.</p>

        <h2>4. Failing to Provide Required Disclosures</h2>
        <p>Utah law requires specific disclosures about lead paint (for pre-1978 properties), mold, and the property owner's information.</p>
        
        <p><strong>The Risk:</strong> Fines up to $16,000 per violation for missing lead paint disclosures, plus liability for tenant health issues.</p>
        
        <p><strong>How to Avoid It:</strong> Create a disclosure checklist and include all required forms with every lease. Update your templates annually to stay current.</p>

        <h2>5. Discriminatory Screening or Policies</h2>
        <p>Fair Housing laws prohibit discrimination based on race, color, religion, sex, familial status, national origin, or disability. Many landlords unknowingly violate these protections.</p>
        
        <p><strong>The Risk:</strong> Lawsuits, fines, and damage to your reputation. Fair Housing violations can cost tens of thousands of dollars.</p>
        
        <p><strong>How to Avoid It:</strong> Use objective screening criteria applied equally to all applicants. Document your process and avoid questions about protected characteristics.</p>

        <h2>6. Entering the Property Without Proper Notice</h2>
        <p>Utah requires landlords to provide at least 24 hours' notice before entering a rental property, except in emergencies.</p>
        
        <p><strong>The Risk:</strong> Privacy violation claims, tenant complaints, and potential lawsuits.</p>
        
        <p><strong>How to Avoid It:</strong> Always provide written notice stating the date, time, and purpose of entry. Keep copies of all notices sent.</p>

        <h2>7. Ignoring Habitability Requirements</h2>
        <p>Utah's implied warranty of habitability requires landlords to maintain properties in livable condition, including working heat, plumbing, and structural safety.</p>
        
        <p><strong>The Risk:</strong> Tenants can withhold rent, break the lease, or sue for damages if you fail to make necessary repairs.</p>
        
        <p><strong>How to Avoid It:</strong> Respond promptly to repair requests, conduct regular property inspections, and document all maintenance work.</p>

        <h2>Stay Protected with the Right Tools</h2>
        <p>Avoiding these legal mistakes doesn't have to be complicated. With the right forms, checklists, and procedures in place, you can protect your rental business and sleep easy knowing you're doing everything by the book.</p>
        
        <p>LeaseShield App provides Utah-specific legal templates, compliance guides, and step-by-step workflows to help you avoid these costly mistakes. Start your free 7-day trial today and protect your investment.</p>
      `,
      author: "Sarah Mitchell, Legal Content Specialist",
      status: "published" as const,
      stateIds: ["UT"],
      tags: ["legal-compliance", "utah", "evictions", "security-deposits"],
      metaTitle: "7 Legal Mistakes Utah Landlords Make | LeaseShield App",
      metaDescription: "Avoid costly legal mistakes as a Utah landlord. Learn about security deposit laws, eviction procedures, Fair Housing compliance, and more.",
      publishedAt: new Date("2024-11-10"),
    },
    {
      title: "Texas Security Deposit Law: Complete Guide for Landlords",
      slug: "texas-security-deposit-law-guide",
      excerpt: "Understanding Texas security deposit requirements, timelines, and deduction rules to protect yourself and stay compliant.",
      content: `
        <h2>Texas Security Deposit Basics</h2>
        <p>Texas has specific laws governing security deposits that every landlord must follow. Unlike some states, Texas doesn't cap the amount you can charge, but it does strictly regulate how and when deposits must be returned.</p>

        <h2>Timeline Requirements</h2>
        <p>You must return the security deposit within 30 days after the tenant moves out. If you make deductions, you must provide an itemized list explaining each charge.</p>
        
        <p><strong>Important:</strong> The 30-day clock starts when the tenant surrenders possession AND provides a forwarding address.</p>

        <h2>Allowed Deductions</h2>
        <p>You can deduct from the security deposit for:</p>
        <ul>
          <li>Unpaid rent</li>
          <li>Damages beyond normal wear and tear</li>
          <li>Unpaid utilities (if stated in lease)</li>
          <li>Other breach of lease terms</li>
        </ul>

        <h2>Normal Wear and Tear vs. Damage</h2>
        <p>Texas courts have established clear guidelines:</p>
        
        <p><strong>Normal Wear and Tear (Cannot Deduct):</strong></p>
        <ul>
          <li>Minor carpet wear from foot traffic</li>
          <li>Faded paint or wallpaper</li>
          <li>Small nail holes from hanging pictures</li>
          <li>Minor scuffs on walls</li>
        </ul>
        
        <p><strong>Damage (Can Deduct):</strong></p>
        <ul>
          <li>Carpet stains or burns</li>
          <li>Holes in walls or doors</li>
          <li>Broken fixtures or appliances</li>
          <li>Missing items that were part of the property</li>
        </ul>

        <h2>The Bad Faith Penalty</h2>
        <p>Here's where Texas law gets serious: if you act in "bad faith" by wrongfully withholding a deposit, you could be liable for:</p>
        <ul>
          <li>$100</li>
          <li>PLUS 3 times the wrongfully withheld amount</li>
          <li>PLUS the tenant's attorney's fees</li>
        </ul>
        
        <p>This means a $1,000 deposit dispute could cost you $3,100 plus legal fees.</p>

        <h2>Proper Documentation</h2>
        <p>Protect yourself by:</p>
        <ol>
          <li>Conducting move-in and move-out inspections with photos/video</li>
          <li>Providing itemized deduction lists with receipts</li>
          <li>Keeping copies of all correspondence</li>
          <li>Mailing deposit returns via certified mail</li>
        </ol>

        <h2>Common Mistakes to Avoid</h2>
        <p>❌ Missing the 30-day deadline<br>
        ❌ Failing to provide itemized deductions<br>
        ❌ Deducting for normal wear and tear<br>
        ❌ Not getting a forwarding address before starting the clock<br>
        ❌ Charging for carpet replacement when only cleaning was needed</p>

        <h2>Templates to Protect Your Business</h2>
        <p>LeaseShield App provides Texas-specific security deposit forms, including:</p>
        <ul>
          <li>Move-In/Move-Out Inspection Checklists</li>
          <li>Security Deposit Accounting Statements</li>
          <li>Notice of Deduction templates</li>
          <li>Photo documentation guides</li>
        </ul>
        
        <p>Start your free 7-day trial and access all Texas landlord forms today.</p>
      `,
      author: "Michael Rodriguez, Texas Property Law Expert",
      status: "published" as const,
      stateIds: ["TX"],
      tags: ["security-deposits", "texas", "legal-compliance"],
      metaTitle: "Texas Security Deposit Law Guide for Landlords | LeaseShield App",
      metaDescription: "Complete guide to Texas security deposit laws, including timelines, allowed deductions, bad faith penalties, and compliance tips.",
      publishedAt: new Date("2024-11-08"),
    },
    {
      title: "Screening Tenants in North Dakota: Fair Housing Compliance",
      slug: "north-dakota-tenant-screening-fair-housing",
      excerpt: "Navigate North Dakota tenant screening requirements while staying compliant with federal Fair Housing laws.",
      content: `
        <h2>The Foundation: Fair Housing Laws</h2>
        <p>Before we dive into North Dakota-specific requirements, remember that federal Fair Housing laws apply everywhere. You cannot discriminate based on:</p>
        <ul>
          <li>Race or color</li>
          <li>National origin</li>
          <li>Religion</li>
          <li>Sex (including sexual orientation and gender identity)</li>
          <li>Familial status (having children)</li>
          <li>Disability</li>
        </ul>

        <h2>North Dakota Screening Standards</h2>
        <p>North Dakota doesn't have additional protected classes beyond federal law, but you still need a compliant screening process.</p>

        <h3>Criminal Background Checks</h3>
        <p>You can consider criminal history, but must:</p>
        <ul>
          <li>Apply screening criteria uniformly to all applicants</li>
          <li>Consider the nature and severity of the crime</li>
          <li>Consider how much time has passed</li>
          <li>Provide applicants opportunity to explain circumstances</li>
        </ul>
        
        <p><strong>Tip:</strong> Blanket "no criminal record" policies are risky under Fair Housing guidance.</p>

        <h3>Credit and Income Verification</h3>
        <p>North Dakota landlords commonly require:</p>
        <ul>
          <li>Credit score minimum (e.g., 600+)</li>
          <li>Income at 2.5-3x monthly rent</li>
          <li>Employment verification</li>
          <li>Rental history references</li>
        </ul>
        
        <p>Whatever standards you set, apply them equally to every applicant.</p>

        <h2>Required Disclosures</h2>
        <p>Before running a background or credit check, you must:</p>
        <ol>
          <li>Get written permission from the applicant</li>
          <li>Disclose that you'll be checking credit/background</li>
          <li>Provide adverse action notices if you deny based on credit report</li>
        </ol>

        <h2>Service and Emotional Support Animals</h2>
        <p>Under Fair Housing law, you must make reasonable accommodations for:</p>
        <ul>
          <li>Service animals (trained to perform specific tasks)</li>
          <li>Emotional support animals (provide therapeutic benefit)</li>
        </ul>
        
        <p>You can ask for documentation of disability-related need, but you cannot:</p>
        <ul>
          <li>Charge pet fees or deposits for these animals</li>
          <li>Deny housing solely because of the animal</li>
          <li>Require specific training or certification</li>
        </ul>

        <h2>Questions You Can and Cannot Ask</h2>
        <p><strong>✅ Safe Questions:</strong></p>
        <ul>
          <li>"How many people will be living in the unit?"</li>
          <li>"Do you have the income to afford rent?"</li>
          <li>"Can you provide references from previous landlords?"</li>
          <li>"Do you have any pets?" (but see service animal rules above)</li>
        </ul>
        
        <p><strong>❌ Risky Questions:</strong></p>
        <ul>
          <li>"Are you married?" (familial status)</li>
          <li>"Where are you from originally?" (national origin)</li>
          <li>"Do you have kids?" (familial status)</li>
          <li>"How old are you?" (while age isn't federally protected, it's poor practice)</li>
          <li>"Do you have any disabilities?"</li>
        </ul>

        <h2>Document Everything</h2>
        <p>The best defense against discrimination claims is consistent documentation:</p>
        <ul>
          <li>Use written screening criteria</li>
          <li>Keep all applications (approved and denied)</li>
          <li>Document reasons for denial</li>
          <li>Save all correspondence</li>
        </ul>

        <h2>Streamline Your Screening Process</h2>
        <p>LeaseShield App provides North Dakota-specific screening tools:</p>
        <ul>
          <li>Fair Housing-compliant application forms</li>
          <li>Screening criteria worksheets</li>
          <li>Credit report authorization templates</li>
          <li>Adverse action notice generators</li>
        </ul>
        
        <p>Try it free for 7 days and protect your screening process.</p>
      `,
      author: "Jennifer Thompson, Fair Housing Specialist",
      status: "published" as const,
      stateIds: ["ND"],
      tags: ["tenant-screening", "fair-housing", "north-dakota", "compliance"],
      metaTitle: "North Dakota Tenant Screening & Fair Housing Guide | LeaseShield App",
      metaDescription: "Learn compliant tenant screening practices for North Dakota landlords, including Fair Housing requirements and documentation best practices.",
      publishedAt: new Date("2024-11-05"),
    },
    {
      title: "South Dakota Eviction Process: Step-by-Step Guide",
      slug: "south-dakota-eviction-process-guide",
      excerpt: "A complete walkthrough of the South Dakota eviction process, from initial notice to court proceedings.",
      content: `
        <h2>When Can You Evict in South Dakota?</h2>
        <p>South Dakota law allows eviction for several reasons:</p>
        <ul>
          <li>Non-payment of rent</li>
          <li>Violation of lease terms</li>
          <li>Property damage beyond normal wear</li>
          <li>Illegal activity on the premises</li>
          <li>End of lease term (no renewal)</li>
        </ul>

        <h2>Step 1: Serve Proper Notice</h2>
        <p>The type of notice depends on the reason for eviction:</p>
        
        <h3>Non-Payment of Rent</h3>
        <p><strong>3-Day Notice to Pay or Quit</strong></p>
        <p>Give the tenant 3 days to pay rent or move out. The notice must:</p>
        <ul>
          <li>State the exact amount owed</li>
          <li>Provide payment instructions</li>
          <li>Be served properly (hand-delivered or posted)</li>
        </ul>

        <h3>Lease Violations</h3>
        <p><strong>Notice to Comply or Quit (varies by violation)</strong></p>
        <p>For lease violations other than non-payment, you typically give:</p>
        <ul>
          <li>3 days for serious violations</li>
          <li>30 days for minor violations (first offense)</li>
        </ul>

        <h3>Month-to-Month Tenancies</h3>
        <p><strong>30-Day Notice to Terminate</strong></p>
        <p>For month-to-month leases with no specific cause, either party can terminate with 30 days' notice.</p>

        <h2>Step 2: File Eviction Lawsuit (Forcible Entry and Detainer)</h2>
        <p>If the tenant doesn't comply with the notice, you can file an eviction lawsuit in the county where the property is located.</p>
        
        <p><strong>Required Documents:</strong></p>
        <ul>
          <li>Summons and Complaint for Eviction</li>
          <li>Copy of the lease</li>
          <li>Copy of the notice served</li>
          <li>Proof of notice delivery</li>
          <li>Filing fee (varies by county)</li>
        </ul>

        <h2>Step 3: Serve the Summons and Complaint</h2>
        <p>The tenant must be personally served with:</p>
        <ul>
          <li>The summons</li>
          <li>The complaint</li>
          <li>Notice of court hearing date</li>
        </ul>
        
        <p>Service must be done by a sheriff, deputy, or process server—not by you.</p>

        <h2>Step 4: Attend the Court Hearing</h2>
        <p>The court will schedule a hearing, typically within 10-21 days. At the hearing:</p>
        
        <p><strong>Bring with you:</strong></p>
        <ul>
          <li>Original lease agreement</li>
          <li>Payment records showing unpaid rent</li>
          <li>Photos of any damage (if applicable)</li>
          <li>Copies of all notices served</li>
          <li>Communication records with tenant</li>
        </ul>
        
        <p>The judge will hear both sides and issue a decision immediately or within a few days.</p>

        <h2>Step 5: Obtain Writ of Restitution</h2>
        <p>If you win, the court issues a Judgment for Possession. You can then request a Writ of Restitution, which:</p>
        <ul>
          <li>Is executed by the sheriff</li>
          <li>Gives the tenant 48 hours to vacate</li>
          <li>Allows sheriff to remove tenant if they don't leave</li>
        </ul>

        <h2>Critical Mistakes to Avoid</h2>
        <p>❌ <strong>Self-Help Evictions</strong><br>
        Never change locks, remove belongings, or shut off utilities. This is illegal and can result in serious penalties.</p>
        
        <p>❌ <strong>Accepting Partial Rent</strong><br>
        If you accept rent after serving notice, you may void the eviction notice.</p>
        
        <p>❌ <strong>Improper Notice Service</strong><br>
        Follow service requirements exactly or your case may be dismissed.</p>
        
        <p>❌ <strong>Missing Court Dates</strong><br>
        If you don't appear, your case will be dismissed.</p>

        <h2>Timeline Overview</h2>
        <p>From start to finish, a South Dakota eviction typically takes:</p>
        <ul>
          <li>3-30 days: Notice period</li>
          <li>10-21 days: Wait for court hearing</li>
          <li>0-7 days: Judgment and writ issuance</li>
          <li>2 days: Final move-out period</li>
        </ul>
        
        <p><strong>Total: 3-8 weeks</strong> (if tenant doesn't contest)</p>

        <h2>Protect Yourself with Proper Forms</h2>
        <p>LeaseShield App provides South Dakota-specific eviction forms:</p>
        <ul>
          <li>3-Day Notice to Pay or Quit</li>
          <li>Notice to Comply or Quit</li>
          <li>30-Day Termination Notice</li>
          <li>Eviction Complaint templates</li>
          <li>Court appearance checklists</li>
        </ul>
        
        <p>Get instant access with a 7-day free trial.</p>
      `,
      author: "David Chen, South Dakota Property Law Attorney",
      status: "published" as const,
      stateIds: ["SD"],
      tags: ["evictions", "south-dakota", "legal-process"],
      metaTitle: "South Dakota Eviction Process Guide | LeaseShield App",
      metaDescription: "Complete step-by-step guide to the South Dakota eviction process, including notice requirements, court procedures, and timeline.",
      publishedAt: new Date("2024-11-01"),
    },
    {
      title: "How to Handle Late Rent Payments: Best Practices for Landlords",
      slug: "handling-late-rent-payments-landlords",
      excerpt: "Establish clear policies and procedures for late rent to protect your cash flow and maintain good tenant relationships.",
      content: `
        <h2>Prevention is the Best Policy</h2>
        <p>The best way to handle late rent is to prevent it. Start with a clear lease that specifies:</p>
        <ul>
          <li>Due date (typically the 1st of the month)</li>
          <li>Grace period (if any)</li>
          <li>Late fees and when they apply</li>
          <li>Acceptable payment methods</li>
          <li>Consequences of non-payment</li>
        </ul>

        <h2>State-Specific Late Fee Limits</h2>
        <p>Each state has different rules about late fees:</p>
        
        <h3>Utah</h3>
        <p>No statutory limit, but fees must be "reasonable" (courts have upheld 5-10% of monthly rent or $50-75 flat fees)</p>
        
        <h3>Texas</h3>
        <p>Must provide at least 2 days' grace period before charging late fees. No specific percentage limit, but must be reasonable.</p>
        
        <h3>North Dakota</h3>
        <p>Can charge late fees if specified in lease and reasonable. Typically 5% of monthly rent or $50.</p>
        
        <h3>South Dakota</h3>
        <p>No specific limits, but fees must be stated in lease and be reasonable.</p>

        <h2>When Rent is Late: Your Action Plan</h2>
        
        <h3>Day 1-3: Friendly Reminder</h3>
        <p>Sometimes tenants simply forget. Send a friendly text or email:</p>
        <blockquote>
          "Hi [Tenant], just a friendly reminder that rent was due on [date]. Please let me know if you have any questions about payment. Thanks!"
        </blockquote>

        <h3>Day 4-5: Formal Notice</h3>
        <p>Send a more formal written notice stating:</p>
        <ul>
          <li>Rent amount owed</li>
          <li>Late fee amount (if applicable)</li>
          <li>Total amount now due</li>
          <li>Payment deadline to avoid further action</li>
        </ul>

        <h3>Day 6-10: Phone Call</h3>
        <p>Make a phone call to understand the situation. Is this:</p>
        <ul>
          <li>A one-time emergency?</li>
          <li>A temporary financial hardship?</li>
          <li>A pattern of late payments?</li>
          <li>A sign they can't afford the rent?</li>
        </ul>

        <h3>Day 11+: Legal Notice</h3>
        <p>If payment still hasn't been made, serve a formal Pay or Quit notice according to your state's requirements (typically 3-5 days).</p>

        <h2>Payment Plans: When and How</h2>
        <p>Consider offering a payment plan for good tenants experiencing temporary hardship:</p>
        
        <p><strong>Put it in writing:</strong></p>
        <ul>
          <li>Payment schedule with specific dates</li>
          <li>Amounts due on each date</li>
          <li>Late fee handling</li>
          <li>Consequences of breaking the agreement</li>
          <li>Statement that eviction may proceed if plan isn't followed</li>
        </ul>
        
        <p><strong>Limit to one-time use:</strong> Don't make payment plans a regular habit or you'll train tenants to pay late.</p>

        <h2>Document Everything</h2>
        <p>Create a paper trail of all communication:</p>
        <ul>
          <li>Save all texts and emails</li>
          <li>Note phone call dates, times, and what was discussed</li>
          <li>Keep copies of all notices sent</li>
          <li>Document how notices were delivered</li>
          <li>Record all payments and late fees</li>
        </ul>

        <h2>Red Flags: When to Act Quickly</h2>
        <p>Some situations warrant immediate action:</p>
        <ul>
          <li>This is the 3rd+ late payment</li>
          <li>Tenant is avoiding communication</li>
          <li>Tenant has broken other lease terms</li>
          <li>You suspect the tenant has moved out</li>
          <li>Property is being damaged</li>
        </ul>

        <h2>Compassion vs. Business</h2>
        <p>It's natural to want to help, especially during hard times. But remember:</p>
        <ul>
          <li>Your mortgage still needs to be paid</li>
          <li>Being "nice" doesn't pay your bills</li>
          <li>Tenants who can't pay should find more affordable housing</li>
          <li>Delaying eviction often makes things worse</li>
        </ul>
        
        <p>You can be empathetic while still protecting your business.</p>

        <h2>Templates to Make It Easier</h2>
        <p>LeaseShield App provides state-specific templates for:</p>
        <ul>
          <li>Friendly rent reminder notices</li>
          <li>Formal late rent notices</li>
          <li>Payment plan agreements</li>
          <li>Pay or Quit notices</li>
          <li>Late payment tracking spreadsheets</li>
        </ul>
        
        <p>Start your 7-day free trial and handle late payments professionally.</p>
      `,
      author: "Amanda Foster, Property Management Consultant",
      status: "published" as const,
      stateIds: ["UT", "TX", "ND", "SD"],
      tags: ["rent-collection", "late-fees", "tenant-relations", "best-practices"],
      metaTitle: "How to Handle Late Rent Payments | Landlord Guide | LeaseShield App",
      metaDescription: "Best practices for handling late rent payments, including state-specific late fee limits, communication strategies, and payment plan templates.",
      publishedAt: new Date("2024-10-28"),
    },
  ];

  for (const post of posts) {
    await db.insert(blogPosts).values(post);
    console.log(`✓ Created blog post: ${post.title}`);
  }

  console.log("\n✅ Blog posts seeded successfully!");
}

seedBlogPosts()
  .catch((error) => {
    console.error("Error seeding blog posts:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
