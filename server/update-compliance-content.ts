import { db } from "./db";
import { complianceCards } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const COMPREHENSIVE_CONTENT: Record<string, Record<string, any>> = {
  WY: {
    "Required Lease Disclosures": {
      summary: "Wyoming requires landlords to make specific disclosures to tenants before signing a lease agreement",
      content: {
        statutes: ["Wyo. Stat. § 1-21-1201 et seq.", "42 U.S.C. § 4852d (Federal Lead Paint)"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978 (federal requirement)",
          "Provide EPA-approved pamphlet 'Protect Your Family From Lead in Your Home'",
          "Disclose name and address of landlord or authorized agent for service of legal notices",
          "Disclose known methamphetamine contamination if property was previously used for meth production",
          "Provide move-in condition checklist documenting property condition"
        ],
        actionableSteps: [
          "Complete and sign EPA lead disclosure form for pre-1978 properties",
          "Include landlord/agent contact information in the lease agreement",
          "Check Wyoming DEQ database for methamphetamine contamination history",
          "Conduct and document move-in inspection with tenant",
          "Keep signed copies of all disclosures for your records"
        ]
      }
    },
    "Security Deposit Rules": {
      summary: "Wyoming law governs how landlords must handle, hold, and return security deposits",
      content: {
        statutes: ["Wyo. Stat. § 1-21-1207", "Wyo. Stat. § 1-21-1208"],
        requirements: [
          "No state-mandated limit on security deposit amount (market typically 1-2 months)",
          "Return deposit within 30 days of lease termination or surrender of premises",
          "Provide written itemized statement of any deductions taken",
          "Deductions allowed only for unpaid rent, damages beyond normal wear, and cleaning costs",
          "Non-refundable fees must be clearly labeled as such in the lease"
        ],
        actionableSteps: [
          "Document property condition at move-in with photos and checklist",
          "Hold deposits in a separate account (recommended but not required)",
          "Conduct move-out inspection with tenant present",
          "Prepare itemized list of damages with repair costs and receipts",
          "Mail deposit refund with itemization within 30 days to tenant's forwarding address"
        ]
      }
    },
    "Eviction Notice Requirements": {
      summary: "Wyoming requires specific notice periods and procedures before initiating eviction proceedings",
      content: {
        statutes: ["Wyo. Stat. § 1-21-1002", "Wyo. Stat. § 1-21-1003"],
        requirements: [
          "3-day notice to pay or quit for nonpayment of rent",
          "3-day notice to cure or vacate for lease violations",
          "Written notice must clearly state the reason for eviction",
          "Notice must be properly served (personal delivery, posting, or certified mail)",
          "Cannot file eviction lawsuit until notice period expires"
        ],
        actionableSteps: [
          "Document the lease violation or missed payment with dates and amounts",
          "Prepare written notice with specific violation details and cure deadline",
          "Serve notice using an acceptable method and keep proof of service",
          "Wait full 3 days before filing Forcible Entry and Detainer action",
          "File eviction complaint in Circuit Court if tenant fails to comply"
        ]
      }
    },
    "Fair Housing Compliance": {
      summary: "Federal and Wyoming fair housing laws prohibit discrimination in rental housing",
      content: {
        statutes: ["Fair Housing Act (42 U.S.C. § 3601 et seq.)", "Wyo. Stat. § 40-24-101 et seq."],
        requirements: [
          "Cannot discriminate based on race, color, religion, national origin, sex, familial status, or disability",
          "Must provide reasonable accommodations for tenants with disabilities",
          "Cannot refuse to rent to families with children (except senior housing exemptions)",
          "Advertising must not indicate preference or limitation based on protected classes",
          "Must apply consistent screening criteria to all applicants"
        ],
        actionableSteps: [
          "Develop written, objective tenant screening criteria",
          "Use the same application and process for all prospective tenants",
          "Document legitimate business reasons for any rental decisions",
          "Train yourself on fair housing requirements and prohibited practices",
          "Consider reasonable accommodation requests on case-by-case basis"
        ]
      }
    }
  },
  CA: {
    "Required Lease Disclosures": {
      summary: "California has extensive disclosure requirements protecting tenants' health and safety",
      content: {
        statutes: ["Cal. Civ. Code § 1940 et seq.", "Cal. Health & Safety Code § 17920.3"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Mold disclosure and information about health risks (AB 2471)",
          "Bed bug disclosure - known infestations and prevention information",
          "Flooding and natural hazard zone disclosures",
          "Demolition intent disclosure if planning to demolish within 3 years",
          "Registered sex offender database notification (Megan's Law)",
          "Pest control company disclosure if using regular pest control services"
        ],
        actionableSteps: [
          "Use California Association of Realtors disclosure forms for completeness",
          "Check Natural Hazard Disclosure reports for the property",
          "Provide written bed bug history and prevention information",
          "Include Megan's Law database website information",
          "Keep signed acknowledgments of all disclosures"
        ]
      }
    },
    "Security Deposit Limits & Return": {
      summary: "California strictly limits security deposit amounts and mandates return timelines",
      content: {
        statutes: ["Cal. Civ. Code § 1950.5", "Cal. Civ. Code § 1950.7"],
        requirements: [
          "Maximum deposit: 2 months' rent (unfurnished) or 3 months' rent (furnished) - NEW: 1 month for most landlords as of 7/1/2024",
          "Return deposit within 21 days of tenant vacating",
          "Provide itemized statement of deductions",
          "Allow tenant to request initial inspection before move-out",
          "Cannot deduct for normal wear and tear"
        ],
        actionableSteps: [
          "Verify your deposit complies with new AB 12 limits if applicable",
          "Offer pre-move-out inspection to tenant 2 weeks before move-out",
          "Document all damages with photos and repair estimates",
          "Mail itemized statement with remaining deposit within 21 days",
          "Keep copies of all receipts for deducted repairs"
        ]
      }
    },
    "Rent Control & Just Cause Eviction": {
      summary: "California's AB 1482 limits rent increases and requires just cause for most evictions",
      content: {
        statutes: ["Cal. Civ. Code § 1946.2", "Cal. Civ. Code § 1947.12 (AB 1482)"],
        requirements: [
          "Rent increases capped at 5% plus local CPI (max 10%) annually for covered properties",
          "Just cause required for evictions after 12 months of tenancy",
          "At-fault just causes: nonpayment, breach, nuisance, illegal activity",
          "No-fault just causes: owner move-in, substantial renovation, withdrawal from rental market",
          "Relocation assistance required for no-fault evictions (1 month rent)"
        ],
        actionableSteps: [
          "Determine if your property is exempt (single-family homes with specific disclosures, new construction, etc.)",
          "Provide required AB 1482 notice to tenants",
          "Calculate maximum allowable rent increase using CPI data",
          "Document just cause thoroughly before serving eviction notice",
          "Budget for relocation assistance if pursuing no-fault eviction"
        ]
      }
    },
    "Fair Housing Compliance": {
      summary: "California has some of the strongest fair housing protections in the nation",
      content: {
        statutes: ["Cal. Gov. Code § 12955 (FEHA)", "Fair Housing Act (Federal)"],
        requirements: [
          "Protected classes include: race, color, religion, sex, gender identity, sexual orientation, marital status, national origin, ancestry, familial status, disability, source of income, veteran status",
          "Cannot discriminate against Section 8 voucher holders (source of income protection)",
          "Must provide reasonable accommodations for disabilities",
          "Cannot inquire about immigration status",
          "Must use consistent screening criteria for all applicants"
        ],
        actionableSteps: [
          "Accept Section 8 and other housing vouchers",
          "Develop written, objective screening criteria before advertising",
          "Train on California-specific protected classes",
          "Document all rental decisions with legitimate business reasons",
          "Consult attorney before denying reasonable accommodation requests"
        ]
      }
    }
  },
  VA: {
    "Required Lease Disclosures": {
      summary: "Virginia landlords must provide specific disclosures at or before lease signing",
      content: {
        statutes: ["Va. Code § 55.1-1204", "Va. Code § 55.1-1215"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Move-in inspection report within 5 days of occupancy",
          "Disclosure of mold or pending building/housing code violations",
          "Disclosure of known defective drywall",
          "Disclosure of landlord's authorized agent for service of notices",
          "Military air installation noise zone disclosure if applicable"
        ],
        actionableSteps: [
          "Complete EPA lead disclosure form for pre-1978 properties",
          "Schedule and conduct move-in inspection within 5 days",
          "Check for any pending code violations before leasing",
          "Include authorized agent information in lease agreement",
          "Check military base proximity for noise zone disclosure requirements"
        ]
      }
    },
    "Security Deposit Handling": {
      summary: "Virginia law governs security deposit limits, holding requirements, and return timelines",
      content: {
        statutes: ["Va. Code § 55.1-1226"],
        requirements: [
          "Maximum deposit: 2 months' rent",
          "Return deposit within 45 days of lease termination",
          "Provide itemized list of deductions",
          "Allow tenant to be present at move-out inspection if requested",
          "No interest required on deposits in Virginia"
        ],
        actionableSteps: [
          "Collect no more than 2 months' rent as deposit",
          "Document property condition at move-in with photos",
          "Notify tenant of right to be present at move-out inspection",
          "Prepare itemized deduction statement with receipts",
          "Mail deposit and statement within 45 days to forwarding address"
        ]
      }
    },
    "Eviction Process Requirements": {
      summary: "Virginia has specific notice requirements and court procedures for evictions",
      content: {
        statutes: ["Va. Code § 55.1-1245", "Va. Code § 55.1-1315"],
        requirements: [
          "5-day notice to pay or quit for nonpayment (14 days for subsidized housing)",
          "21-day notice to cure for lease violations (30 days for material health/safety issues)",
          "30-day notice for month-to-month termination",
          "Must file Unlawful Detainer in General District Court",
          "Cannot use self-help eviction methods"
        ],
        actionableSteps: [
          "Determine correct notice period based on violation type",
          "Prepare and serve written notice with specific details",
          "Document proof of service (certified mail, posting, etc.)",
          "File Unlawful Detainer complaint after notice period expires",
          "Attend court hearing with all documentation"
        ]
      }
    }
  },
  NV: {
    "Required Lease Disclosures": {
      summary: "Nevada requires specific disclosures to protect tenant health and safety",
      content: {
        statutes: ["NRS 118A.200", "NRS 118A.275"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Disclosure of foreclosure proceedings if applicable",
          "Landlord's name and address for service of notices",
          "Move-in inspection checklist",
          "Disclosure of known defects affecting habitability"
        ],
        actionableSteps: [
          "Complete EPA lead disclosure for pre-1978 properties",
          "Provide written notice of any foreclosure proceedings",
          "Include landlord/agent contact information in lease",
          "Conduct thorough move-in inspection with tenant",
          "Document any known property issues in writing"
        ]
      }
    },
    "Security Deposit Rules": {
      summary: "Nevada law limits deposits and requires timely return with itemization",
      content: {
        statutes: ["NRS 118A.242"],
        requirements: [
          "Maximum deposit: 3 months' rent",
          "Return deposit within 30 days of lease termination",
          "Provide itemized accounting of any deductions",
          "Tenant may request walk-through inspection before move-out",
          "Cannot deduct for normal wear and tear"
        ],
        actionableSteps: [
          "Document property condition at move-in with photos and checklist",
          "Offer walk-through inspection before tenant's final move-out",
          "Prepare itemized list of damages with cost estimates",
          "Mail deposit refund and itemization within 30 days",
          "Keep copies of all documentation for 6 years"
        ]
      }
    },
    "Eviction Notice Requirements": {
      summary: "Nevada has specific notice periods based on the reason for eviction",
      content: {
        statutes: ["NRS 40.253", "NRS 40.254"],
        requirements: [
          "7-day notice to pay or quit for nonpayment of rent",
          "5-day notice for lease violations (with right to cure)",
          "30-day notice for month-to-month termination",
          "Notice must be served in writing",
          "Eviction through Justice Court after notice expires"
        ],
        actionableSteps: [
          "Document the specific violation or missed rent payment",
          "Prepare written notice with all required information",
          "Serve notice via personal delivery, posting, or certified mail",
          "Wait full notice period before filing eviction",
          "File Summary Eviction in Justice Court if tenant doesn't comply"
        ]
      }
    }
  },
  AZ: {
    "Required Lease Disclosures": {
      summary: "Arizona requires landlords to make specific disclosures before lease signing",
      content: {
        statutes: ["A.R.S. § 33-1321", "A.R.S. § 33-1322"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Move-in/move-out inspection checklist",
          "Disclosure of landlord/agent contact information",
          "Pool safety disclosure if property has a pool",
          "Disclosure of bed bug inspection results if conducted",
          "Disclosure of past flooding if in flood zone"
        ],
        actionableSteps: [
          "Complete EPA lead disclosure form for pre-1978 properties",
          "Conduct thorough move-in inspection with tenant",
          "Provide pool safety notice and gate access information",
          "Document any known pest issues",
          "Include emergency contact information in lease"
        ]
      }
    },
    "Security Deposit Limits": {
      summary: "Arizona limits security deposits and mandates return timelines",
      content: {
        statutes: ["A.R.S. § 33-1321"],
        requirements: [
          "Maximum deposit: 1.5 months' rent",
          "Return deposit within 14 days of lease termination",
          "Provide itemized statement of deductions",
          "Conduct move-out inspection (tenant may be present)",
          "Cannot deduct for normal wear and tear"
        ],
        actionableSteps: [
          "Collect no more than 1.5 months' rent as deposit",
          "Schedule move-out inspection with tenant",
          "Document damages with photographs and written descriptions",
          "Prepare itemized deduction list with receipts",
          "Return remaining deposit within 14 days"
        ]
      }
    },
    "Eviction Notice Requirements": {
      summary: "Arizona specifies notice periods and procedures for different eviction reasons",
      content: {
        statutes: ["A.R.S. § 33-1368", "A.R.S. § 33-1377"],
        requirements: [
          "5-day notice to pay or quit for nonpayment",
          "10-day notice for lease violations (with right to cure)",
          "Immediate notice for health/safety violations or illegal activity",
          "Written notice must specify the violation",
          "File eviction through Justice Court after notice period"
        ],
        actionableSteps: [
          "Document the violation with dates and specifics",
          "Prepare written notice with cure period information",
          "Serve notice through proper legal methods",
          "Wait full notice period before court filing",
          "File Special Detainer action in Justice Court"
        ]
      }
    }
  },
  FL: {
    "Required Lease Disclosures": {
      summary: "Florida requires specific disclosures to inform tenants about property conditions and rights",
      content: {
        statutes: ["Fla. Stat. § 83.50", "Fla. Stat. § 83.49"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Radon gas disclosure (specific statutory language required)",
          "Landlord's name and address for service of notices",
          "Security deposit holding institution and account type",
          "Fire protection disclosure for buildings 3+ stories"
        ],
        actionableSteps: [
          "Include statutory radon disclosure language in every lease",
          "Complete EPA lead disclosure for pre-1978 properties",
          "Provide bank name and whether deposit earns interest",
          "Include fire safety information for multi-story buildings",
          "Keep copies of all signed disclosures"
        ]
      }
    },
    "Security Deposit Requirements": {
      summary: "Florida has specific rules for holding and returning security deposits",
      content: {
        statutes: ["Fla. Stat. § 83.49"],
        requirements: [
          "No statutory limit on deposit amount",
          "Must notify tenant within 30 days of receipt where deposit is held",
          "Return deposit within 15-60 days depending on whether claiming damages",
          "If claiming, send notice of claim within 30 days",
          "Tenant has 15 days to object to proposed deductions"
        ],
        actionableSteps: [
          "Send written notice of deposit location within 30 days",
          "Document property condition at move-in and move-out",
          "If no deductions, return deposit within 15 days",
          "If claiming deductions, send certified letter within 30 days",
          "Keep copies of all notices and receipts for 5 years"
        ]
      }
    },
    "Eviction Notice Requirements": {
      summary: "Florida requires specific written notices before filing eviction proceedings",
      content: {
        statutes: ["Fla. Stat. § 83.56"],
        requirements: [
          "3-day notice to pay or vacate for nonpayment (excluding weekends/holidays)",
          "7-day notice for lease violations (with opportunity to cure)",
          "7-day unconditional notice for repeated violations or uncurable breaches",
          "15-day notice for month-to-month termination",
          "Written notice must specify the violation and action required"
        ],
        actionableSteps: [
          "Calculate notice period excluding weekends and holidays for rent",
          "Prepare written notice with specific violation details",
          "Serve notice via posting, certified mail, or personal delivery",
          "Wait full notice period before filing eviction",
          "File eviction complaint in County Court"
        ]
      }
    }
  }
};

async function updateComplianceContent() {
  console.log("🔧 Updating compliance cards with comprehensive content...\n");

  for (const [stateCode, cards] of Object.entries(COMPREHENSIVE_CONTENT)) {
    console.log(`\n📍 Processing ${stateCode}...`);

    for (const [title, data] of Object.entries(cards)) {
      try {
        const result = await db.update(complianceCards)
          .set({ 
            summary: data.summary,
            content: data.content 
          })
          .where(and(
            eq(complianceCards.stateId, stateCode),
            eq(complianceCards.title, title)
          ));
        
        console.log(`  ✅ Updated: ${title}`);
      } catch (error: any) {
        console.error(`  ❌ Error updating ${title}:`, error.message);
      }
    }
  }

  console.log("\n✅ Compliance content update complete!");
}

updateComplianceContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error updating compliance content:", error);
    process.exit(1);
  });
