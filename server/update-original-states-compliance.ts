import { db } from "./db";
import { complianceCards } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const COMPREHENSIVE_CONTENT: Record<string, Record<string, any>> = {
  UT: {
    "Required Lease Disclosures": {
      summary: "Utah requires landlords to make specific written disclosures in all residential lease agreements",
      content: {
        statutes: ["Utah Code § 57-22-4", "42 U.S.C. § 4852d (Federal Lead Paint)"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978 (federal requirement)",
          "Provide EPA-approved pamphlet 'Protect Your Family From Lead in Your Home'",
          "Disclose known mold issues and provide Utah mold addendum",
          "Security deposit terms including amount, conditions, and 30-day return requirement",
          "Landlord/agent name and address for service of legal notices",
          "Move-in condition checklist documenting property state"
        ],
        actionableSteps: [
          "Complete EPA lead disclosure form for pre-1978 properties",
          "Include Utah mold disclosure addendum in lease package",
          "Clearly state security deposit amount and deduction conditions in lease",
          "Provide your contact information for legal notices",
          "Conduct and document move-in inspection with tenant signatures",
          "Keep signed copies of all disclosures for your records"
        ]
      }
    },
    "Security Deposit Return Timeline": {
      summary: "Utah law strictly governs how and when security deposits must be returned to tenants",
      content: {
        statutes: ["Utah Code § 57-17-3", "Utah Code § 57-17-5"],
        requirements: [
          "Return deposit within 30 days of lease termination",
          "Provide itemized written statement of any deductions",
          "Deductions allowed only for unpaid rent, damages beyond normal wear, and cleaning",
          "Receipts required for deductions exceeding $200",
          "Failure to comply within 30 days forfeits right to deductions",
          "Tenant entitled to remaining deposit plus interest if applicable"
        ],
        actionableSteps: [
          "Document property condition at move-in with photos and checklist",
          "Schedule move-out inspection with tenant present when possible",
          "Photograph all damages and keep repair receipts",
          "Prepare itemized deduction list with cost breakdowns",
          "Mail deposit refund with itemization within 30 days to forwarding address",
          "Keep copies of all documentation for at least 3 years"
        ]
      }
    },
    "Eviction Notice Requirements": {
      summary: "Utah has specific notice periods and requirements before filing eviction proceedings",
      content: {
        statutes: ["Utah Code § 78B-6-802", "Utah Code § 78B-6-805"],
        requirements: [
          "3-day notice to pay or quit for nonpayment of rent",
          "3-day notice for criminal activity or nuisance",
          "5-day notice to cure or quit for other lease violations",
          "15-day notice for month-to-month termination",
          "Written notice must clearly state reason and deadline",
          "Cannot file eviction until notice period expires"
        ],
        actionableSteps: [
          "Document the lease violation or missed payment with specific dates and amounts",
          "Prepare written notice with all required information",
          "Serve notice via personal delivery, posting on door, or certified mail",
          "Keep proof of service (signed receipt, photo of posted notice, mail receipt)",
          "Wait full notice period before filing eviction in court",
          "File Unlawful Detainer complaint in district court with proof of notice"
        ]
      }
    },
    "Fair Housing Compliance": {
      summary: "Federal and Utah fair housing laws prohibit discrimination in rental housing",
      content: {
        statutes: ["Fair Housing Act (42 U.S.C. § 3601 et seq.)", "Utah Code § 57-21-5"],
        requirements: [
          "Cannot discriminate based on race, color, religion, national origin, sex, familial status, or disability",
          "Utah adds source of income as a protected class",
          "Must provide reasonable accommodations for tenants with disabilities",
          "Cannot refuse to rent to families with children (except senior housing)",
          "Advertising cannot indicate preference based on protected classes",
          "Must apply consistent screening criteria to all applicants"
        ],
        actionableSteps: [
          "Develop written, objective tenant screening criteria before advertising",
          "Use the same application and process for every prospective tenant",
          "Document legitimate business reasons for any rental decision",
          "Consider reasonable accommodation requests on case-by-case basis",
          "Allow service animals and emotional support animals with proper documentation",
          "Train yourself on fair housing requirements and keep records of compliance"
        ]
      }
    }
  },
  TX: {
    "Required Property Disclosures": {
      summary: "Texas requires landlords to disclose specific property conditions and safety information",
      content: {
        statutes: ["Texas Property Code § 92.056", "Texas Property Code § 92.153"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Security device disclosure if property lacks required deadbolts, window latches, or peepholes",
          "Flooding history disclosure if property flooded in past 5 years or is in 100-year floodplain",
          "Mold remediation rights notice explaining tenant's repair request procedures",
          "Smoke alarm compliance certification at lease signing",
          "Landlord/agent contact information for emergencies and repairs"
        ],
        actionableSteps: [
          "Complete EPA lead disclosure form for pre-1978 properties",
          "Inspect and document all security devices before leasing",
          "Check FEMA flood maps and disclose any flooding history",
          "Include Texas mold rights notice in lease addendum",
          "Test and document smoke alarm functionality",
          "Provide 24-hour emergency contact information in writing"
        ]
      }
    },
    "Security Deposit Limits & Return": {
      summary: "Texas law limits security deposits and mandates strict return timelines",
      content: {
        statutes: ["Texas Property Code § 92.103", "Texas Property Code § 92.104", "Texas Property Code § 92.109"],
        requirements: [
          "No statutory limit on deposit amount (market typically 1-2 months)",
          "Return deposit within 30 days of move-out",
          "Provide itemized list of all deductions",
          "Cannot deduct for normal wear and tear",
          "Tenant may sue for 3x wrongful deductions plus $100",
          "Bad faith retention: tenant entitled to $100 statutory penalty plus attorney fees"
        ],
        actionableSteps: [
          "Document property condition at move-in with dated photos",
          "Conduct walk-through inspection with tenant at move-out",
          "Photograph all damages and obtain repair estimates",
          "Prepare detailed itemized statement with receipts",
          "Mail refund and statement within 30 days to forwarding address",
          "Keep copies of all documentation for at least 4 years"
        ]
      }
    },
    "Eviction Notice Timeline": {
      summary: "Texas has specific notice requirements based on reason for eviction",
      content: {
        statutes: ["Texas Property Code § 24.005", "Texas Property Code § 92.019"],
        requirements: [
          "3-day notice to vacate for nonpayment (unless lease specifies otherwise)",
          "Notice must be in writing and demand possession",
          "No cure period required for nonpayment in Texas",
          "30-day notice for month-to-month termination (unless lease specifies different)",
          "Cannot file eviction until notice period expires",
          "Self-help evictions (lockouts, utility shutoffs) are illegal"
        ],
        actionableSteps: [
          "Review lease for any modified notice periods",
          "Prepare written notice to vacate with specific demand for possession",
          "Serve notice via personal delivery, certified mail, or posting on inside of main door",
          "Document method of service with photos/receipts",
          "Wait full notice period before filing eviction suit",
          "File Forcible Entry and Detainer in Justice Court after notice expires"
        ]
      }
    },
    "Fair Housing Compliance": {
      summary: "Federal and Texas fair housing laws protect tenants from discrimination",
      content: {
        statutes: ["Fair Housing Act (42 U.S.C. § 3601)", "Texas Property Code Chapter 301"],
        requirements: [
          "Cannot discriminate based on race, color, religion, national origin, sex, familial status, or disability",
          "Must provide reasonable accommodations for tenants with disabilities",
          "Cannot refuse families with children except in qualifying senior communities",
          "Advertising cannot indicate preference based on protected classes",
          "Must use consistent screening criteria for all applicants",
          "Cannot retaliate against tenants who file fair housing complaints"
        ],
        actionableSteps: [
          "Create written screening criteria before advertising property",
          "Apply same standards to every applicant consistently",
          "Document business reasons for all rental decisions",
          "Respond to accommodation requests in writing within reasonable time",
          "Keep detailed records of all applications and decisions",
          "Consider consulting Texas Workforce Commission Civil Rights Division for guidance"
        ]
      }
    }
  },
  ND: {
    "Landlord Disclosure Requirements": {
      summary: "North Dakota requires specific disclosures to protect tenant health and safety",
      content: {
        statutes: ["N.D. Cent. Code § 47-16-07.2", "42 U.S.C. § 4852d"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Provide EPA-approved lead hazard information pamphlet",
          "Disclose name and address of landlord or authorized agent",
          "Disclose location of security deposit and terms for return",
          "Move-in condition checklist recommended",
          "Disclose any known material defects affecting habitability"
        ],
        actionableSteps: [
          "Complete federal lead disclosure form for pre-1978 properties",
          "Include landlord/agent contact information in lease",
          "Specify where security deposit is held and return conditions",
          "Conduct detailed move-in inspection with tenant",
          "Document all disclosures in writing with tenant signature",
          "Keep signed copies for your records"
        ]
      }
    },
    "Security Deposit Handling": {
      summary: "North Dakota law governs security deposit amounts, holding, and return requirements",
      content: {
        statutes: ["N.D. Cent. Code § 47-16-07.1"],
        requirements: [
          "Maximum deposit: 1 month's rent (2 months for pet deposit combined)",
          "Return deposit within 30 days of lease termination",
          "Provide itemized statement of any deductions",
          "Cannot deduct for normal wear and tear",
          "Landlord forfeits right to deductions if no itemization provided",
          "Deposit must be returned to tenant's last known address"
        ],
        actionableSteps: [
          "Limit total deposits (security + pet) to 2 months' rent maximum",
          "Document property condition with photos at move-in",
          "Conduct move-out inspection and document damages",
          "Prepare itemized deduction list with cost estimates",
          "Mail deposit refund and itemization within 30 days",
          "Get forwarding address from tenant at move-out"
        ]
      }
    },
    "Eviction Notice Requirements": {
      summary: "North Dakota requires specific written notice before eviction proceedings",
      content: {
        statutes: ["N.D. Cent. Code § 33-06-01", "N.D. Cent. Code § 47-32-01"],
        requirements: [
          "3-day notice to pay or quit for nonpayment of rent",
          "3-day notice for lease violations",
          "30-day notice for month-to-month termination",
          "Written notice must state specific reason for eviction",
          "Notice must be properly served (personal, posting, or mail)",
          "Cannot file eviction until notice period expires"
        ],
        actionableSteps: [
          "Document the specific violation or missed payment",
          "Prepare written notice with clear deadline and required action",
          "Serve notice via personal delivery, posting, or certified mail",
          "Keep proof of service (signature, photo, mail receipt)",
          "Wait full notice period before court filing",
          "File eviction action in district court after notice expires"
        ]
      }
    },
    "Fair Housing Compliance": {
      summary: "Federal and North Dakota fair housing laws prohibit discrimination in housing",
      content: {
        statutes: ["Fair Housing Act (42 U.S.C. § 3601)", "N.D. Cent. Code § 14-02.4"],
        requirements: [
          "Cannot discriminate based on race, color, religion, national origin, sex, familial status, or disability",
          "North Dakota adds: status with respect to marriage and public assistance",
          "Must provide reasonable accommodations for disabilities",
          "Cannot refuse families with children except senior housing",
          "Advertising cannot indicate preference based on protected classes",
          "Must apply consistent screening criteria to all applicants"
        ],
        actionableSteps: [
          "Develop written screening criteria before advertising",
          "Apply same standards to every applicant",
          "Document legitimate business reasons for rental decisions",
          "Consider all reasonable accommodation requests",
          "Keep records of all applications and decisions",
          "Contact ND Department of Labor for fair housing guidance"
        ]
      }
    }
  },
  SD: {
    "Required Lease Disclosures": {
      summary: "South Dakota requires specific disclosures to inform tenants of their rights",
      content: {
        statutes: ["SDCL § 43-32-8", "42 U.S.C. § 4852d"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Provide EPA-approved lead hazard information pamphlet",
          "Landlord/agent name and address for service of notices",
          "Security deposit terms and conditions for return",
          "Move-in condition documentation recommended",
          "Disclosure of known hazardous conditions"
        ],
        actionableSteps: [
          "Complete federal lead disclosure form for pre-1978 properties",
          "Include landlord contact information in lease agreement",
          "Specify deposit amount, holding terms, and return conditions",
          "Conduct detailed move-in inspection with tenant",
          "Keep signed acknowledgments of all disclosures",
          "Provide copies of all signed documents to tenant"
        ]
      }
    },
    "Security Deposit Return Rules": {
      summary: "South Dakota law governs how security deposits must be handled and returned",
      content: {
        statutes: ["SDCL § 43-32-6.1", "SDCL § 43-32-24"],
        requirements: [
          "Maximum deposit: 1 month's rent",
          "Return deposit within 14 days if no deductions, 45 days if deductions",
          "Provide itemized written statement of all deductions",
          "Cannot deduct for normal wear and tear",
          "Tenant can recover twice the deposit if landlord acts in bad faith",
          "Must mail to tenant's forwarding address"
        ],
        actionableSteps: [
          "Collect no more than 1 month's rent as security deposit",
          "Document property condition with photos at move-in",
          "Get tenant's forwarding address at move-out",
          "Prepare itemized deduction statement with receipts",
          "Mail full refund within 14 days if no deductions",
          "Mail refund with itemization within 45 days if claiming damages"
        ]
      }
    },
    "Eviction Notice Timeline": {
      summary: "South Dakota has specific notice requirements for different eviction reasons",
      content: {
        statutes: ["SDCL § 21-16-1", "SDCL § 21-16-2"],
        requirements: [
          "3-day notice to pay or quit for nonpayment",
          "3-day notice for breach of lease",
          "30-day notice for month-to-month termination",
          "Written notice required specifying reason and deadline",
          "Must be properly served before court filing",
          "Self-help evictions are prohibited"
        ],
        actionableSteps: [
          "Document the violation or missed rent with specific dates",
          "Prepare written notice with required cure period",
          "Serve notice via personal delivery, posting, or certified mail",
          "Keep proof of service for court",
          "Wait full notice period before filing",
          "File Forcible Entry and Detainer in circuit court"
        ]
      }
    },
    "Fair Housing Compliance": {
      summary: "Federal and South Dakota fair housing laws protect tenants from discrimination",
      content: {
        statutes: ["Fair Housing Act (42 U.S.C. § 3601)", "SDCL Chapter 20-13"],
        requirements: [
          "Cannot discriminate based on race, color, religion, national origin, sex, familial status, or disability",
          "South Dakota adds: ancestry and creed as protected classes",
          "Must provide reasonable accommodations for disabilities",
          "Cannot refuse families with children except senior housing",
          "Must use consistent screening criteria",
          "Cannot retaliate against fair housing complaints"
        ],
        actionableSteps: [
          "Create written tenant screening policy",
          "Apply standards consistently to all applicants",
          "Document reasons for all rental decisions",
          "Respond to accommodation requests promptly",
          "Allow service and emotional support animals",
          "Contact SD Division of Human Rights for guidance"
        ]
      }
    }
  },
  NC: {
    "Required Lease Disclosures": {
      summary: "North Carolina requires specific disclosures to protect tenant health and safety",
      content: {
        statutes: ["N.C. Gen. Stat. § 42-46", "N.C. Gen. Stat. § 42-44"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Landlord/agent name and address for service of notices",
          "Disclosure of any pending foreclosure proceedings",
          "Security deposit terms including maximum and return timeline",
          "Move-in/move-out inspection rights",
          "Disclosure of known material defects"
        ],
        actionableSteps: [
          "Complete federal lead disclosure form for pre-1978 properties",
          "Include landlord/agent contact information in lease",
          "Disclose any foreclosure proceedings immediately",
          "Explain security deposit terms in writing",
          "Conduct move-in inspection with tenant",
          "Provide copies of all signed disclosures to tenant"
        ]
      }
    },
    "Security Deposit Rules": {
      summary: "North Carolina strictly limits security deposits and mandates return procedures",
      content: {
        statutes: ["N.C. Gen. Stat. § 42-50", "N.C. Gen. Stat. § 42-51", "N.C. Gen. Stat. § 42-52"],
        requirements: [
          "Maximum deposit: 2 months' rent for long-term leases, 2 weeks for weekly rentals",
          "Must deposit in trust account at licensed NC bank",
          "Notify tenant of bank name and address within 30 days of receiving deposit",
          "Return deposit within 30 days of lease termination",
          "Provide itemized accounting of any deductions",
          "Tenant may recover deposit plus attorney fees for violations"
        ],
        actionableSteps: [
          "Open trust account at NC-licensed bank for deposits",
          "Send written notice of bank information within 30 days",
          "Document property condition at move-in and move-out",
          "Keep receipts for all repairs deducted from deposit",
          "Mail deposit refund and itemization within 30 days",
          "Include bank account interest if earned"
        ]
      }
    },
    "Eviction Procedures": {
      summary: "North Carolina has specific notice and court procedures for evictions",
      content: {
        statutes: ["N.C. Gen. Stat. § 42-3", "N.C. Gen. Stat. § 42-14"],
        requirements: [
          "10-day notice to pay or quit for nonpayment",
          "Immediate notice for criminal activity or significant lease violations",
          "7-day notice for month-to-month termination",
          "Written notice must include amount due and deadline",
          "Eviction filing in small claims or district court",
          "Tenant has right to cure within notice period"
        ],
        actionableSteps: [
          "Serve 10-day pay or quit notice for unpaid rent",
          "Document service method and date with photos/receipts",
          "Calculate exact amount owed including late fees",
          "File Summary Ejectment in court after notice expires",
          "Attend court hearing with all documentation",
          "Obtain Writ of Possession for sheriff to execute"
        ]
      }
    },
    "Fair Housing Compliance": {
      summary: "Federal and North Carolina fair housing laws prohibit discrimination",
      content: {
        statutes: ["Fair Housing Act (42 U.S.C. § 3601)", "N.C. Gen. Stat. § 41A-4"],
        requirements: [
          "Cannot discriminate based on race, color, religion, national origin, sex, familial status, or disability",
          "Must provide reasonable accommodations for disabilities",
          "Cannot refuse families with children except qualifying senior housing",
          "Advertising cannot indicate preference based on protected classes",
          "Must apply consistent screening criteria",
          "Cannot retaliate against fair housing complaints"
        ],
        actionableSteps: [
          "Develop written, objective screening criteria",
          "Use identical application process for every applicant",
          "Document business reasons for all rental decisions",
          "Respond promptly to accommodation requests",
          "Allow service and emotional support animals",
          "Contact NC Human Relations Commission for guidance"
        ]
      }
    }
  },
  OH: {
    "Required Lease Disclosures": {
      summary: "Ohio requires landlords to make specific disclosures before lease signing",
      content: {
        statutes: ["Ohio Rev. Code § 5321.01", "42 U.S.C. § 4852d"],
        requirements: [
          "Lead-based paint disclosure for properties built before 1978",
          "Provide EPA lead hazard information pamphlet",
          "Landlord/agent name and address for service of notices",
          "Disclosure of any outstanding code violations",
          "Move-in condition checklist recommended",
          "Security deposit terms and bank information"
        ],
        actionableSteps: [
          "Complete federal lead disclosure form for pre-1978 properties",
          "Include landlord contact information in lease",
          "Check for and disclose any open code violations",
          "Conduct detailed move-in inspection with tenant",
          "Specify deposit terms clearly in lease",
          "Keep signed copies of all disclosures"
        ]
      }
    },
    "Security Deposit Limits & Return": {
      summary: "Ohio law governs security deposit handling and return timelines",
      content: {
        statutes: ["Ohio Rev. Code § 5321.16"],
        requirements: [
          "No statutory limit on deposit amount (market typically 1-2 months)",
          "Return deposit within 30 days of lease termination",
          "Provide itemized statement of any deductions",
          "Cannot deduct for normal wear and tear",
          "Tenant may recover double deposit plus attorney fees for wrongful withholding",
          "Must mail to tenant's last known address"
        ],
        actionableSteps: [
          "Document property condition at move-in with photos",
          "Conduct move-out walk-through with tenant when possible",
          "Photograph all damages and get repair estimates",
          "Prepare itemized deduction statement with receipts",
          "Mail deposit refund within 30 days to forwarding address",
          "Keep copies of all documentation for at least 6 years"
        ]
      }
    },
    "Eviction Notice Requirements": {
      summary: "Ohio has specific notice periods and procedures for evictions",
      content: {
        statutes: ["Ohio Rev. Code § 1923.04", "Ohio Rev. Code § 5321.17"],
        requirements: [
          "3-day notice to pay or quit for nonpayment of rent",
          "30-day notice for lease violations (with opportunity to cure)",
          "30-day notice for month-to-month termination",
          "Written notice must specify violation and deadline",
          "File Forcible Entry and Detainer after notice expires",
          "Self-help evictions are prohibited in Ohio"
        ],
        actionableSteps: [
          "Document the specific violation or missed payment",
          "Prepare written notice with cure period if applicable",
          "Serve notice via personal delivery, posting, or certified mail",
          "Keep proof of service for court",
          "Wait full notice period before filing",
          "File eviction in Municipal Court or County Court"
        ]
      }
    },
    "Fair Housing Compliance": {
      summary: "Federal and Ohio fair housing laws protect tenants from discrimination",
      content: {
        statutes: ["Fair Housing Act (42 U.S.C. § 3601)", "Ohio Rev. Code § 4112.02"],
        requirements: [
          "Cannot discriminate based on race, color, religion, national origin, sex, familial status, or disability",
          "Ohio adds: ancestry and military status as protected classes",
          "Must provide reasonable accommodations for disabilities",
          "Cannot refuse families with children except senior housing",
          "Must apply consistent screening criteria",
          "Cannot retaliate against fair housing complaints"
        ],
        actionableSteps: [
          "Create written tenant screening policy",
          "Apply standards equally to all applicants",
          "Document reasons for all rental decisions",
          "Respond to accommodation requests promptly and in writing",
          "Allow service and emotional support animals",
          "Contact Ohio Civil Rights Commission for guidance"
        ]
      }
    }
  }
};

async function updateOriginalStatesCompliance() {
  console.log("🔧 Updating compliance cards for original states with comprehensive content...\n");

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

  console.log("\n✅ Original states compliance content update complete!");
}

updateOriginalStatesCompliance()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error updating compliance content:", error);
    process.exit(1);
  });
