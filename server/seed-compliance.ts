import { db } from "./db";
import { complianceCards } from "@shared/schema";
import { generateComplianceKey } from "./utils/seedHelpers";

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

  // WYOMING Compliance Cards
  {
    stateId: "WY",
    title: "Required Lease Disclosures",
    summary: "Wyoming requires specific disclosures to protect landlords and tenants under state law",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Lead-Based Paint Disclosure",
          content: "Required for properties built before 1978. Must provide EPA-approved pamphlet and disclosure form.",
        },
        {
          title: "Landlord/Agent Identity",
          content: "Lease must disclose the name and address of landlord or authorized agent for legal notices.",
        },
        {
          title: "Methamphetamine Contamination",
          content: "If property was previously used for meth production, landlord must disclose this information.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "WY",
    title: "Security Deposit Rules",
    summary: "Wyoming limits deposits and sets clear return deadlines under Wyo. Stat. § 1-21-1207",
    category: "deposits",
    content: {
      sections: [
        {
          title: "No State Limit",
          content: "Wyoming has no statutory limit on security deposit amounts, but market typically keeps them at 1-2 months rent.",
        },
        {
          title: "30-Day Return Requirement",
          content: "Landlords must return deposit or provide itemized deductions within 30 days of lease termination.",
        },
        {
          title: "Written Itemization Required",
          content: "Any deductions must be itemized in writing with description of damages and costs.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "WY",
    title: "Eviction Notice Requirements",
    summary: "Wyoming Statutes specify notice periods before eviction proceedings can begin",
    category: "evictions",
    content: {
      sections: [
        {
          title: "3-Day Notice (Non-Payment)",
          content: "For unpaid rent, serve 3-day notice to pay or quit before filing eviction.",
        },
        {
          title: "3-Day Notice (Lease Violations)",
          content: "For lease violations, provide 3-day notice to cure or vacate.",
        },
        {
          title: "Written Notice Required",
          content: "All eviction notices must be in writing and properly delivered to tenant.",
        },
      ],
    },
    sortOrder: 3,
  },

  // CALIFORNIA Compliance Cards
  {
    stateId: "CA",
    title: "Required Lease Disclosures",
    summary: "California has extensive disclosure requirements under Civil Code and Health & Safety Code",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Lead-Based Paint Disclosure",
          content: "Required for pre-1978 properties. Must provide EPA pamphlet and signed disclosure form.",
        },
        {
          title: "Mold Disclosure",
          content: "Landlords must disclose known mold contamination. California provides specific booklet requirements.",
        },
        {
          title: "Bed Bug Disclosure",
          content: "Must disclose known bed bug infestations and provide bed bug informational notice.",
        },
        {
          title: "Flooding and Natural Hazards",
          content: "Must disclose if property is in flood zone, fire hazard zone, or earthquake fault zone.",
        },
        {
          title: "Demolition Intent",
          content: "If planning to demolish or convert within 3 years, must disclose in writing.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "CA",
    title: "Security Deposit Limits & Return",
    summary: "California strictly limits deposits and requires 21-day return under Civil Code § 1950.5",
    category: "deposits",
    content: {
      sections: [
        {
          title: "Deposit Limits",
          content: "Maximum 2 months rent for unfurnished, 3 months for furnished. Starting 2024, limits reduced for many landlords.",
        },
        {
          title: "21-Day Return Requirement",
          content: "Landlords must return deposit or provide itemized statement within 21 days of move-out.",
        },
        {
          title: "Itemized Deductions",
          content: "Must provide receipts or good faith estimates for all deductions. Tenant can request receipts.",
        },
        {
          title: "Bad Faith Penalties",
          content: "Wrongful withholding can result in statutory damages up to twice the deposit amount.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "CA",
    title: "Eviction Notice Requirements",
    summary: "California eviction procedures are strictly regulated under Code of Civil Procedure",
    category: "evictions",
    content: {
      sections: [
        {
          title: "3-Day Notice (Non-Payment)",
          content: "For unpaid rent, serve 3-day notice to pay or quit. Must be served properly.",
        },
        {
          title: "3-Day Notice (Lease Violations)",
          content: "For curable lease violations, 3-day notice to cure or quit required.",
        },
        {
          title: "Just Cause Required",
          content: "Under AB 1482, most tenants after 12 months have just cause eviction protections.",
        },
        {
          title: "Rent Control Considerations",
          content: "Many cities have additional rent control and eviction protections—check local ordinances.",
        },
      ],
    },
    sortOrder: 3,
  },
  {
    stateId: "CA",
    title: "Rent Control & Tenant Protections",
    summary: "California's Tenant Protection Act (AB 1482) provides statewide rent caps and just cause protections",
    category: "fair_housing",
    content: {
      sections: [
        {
          title: "Statewide Rent Cap",
          content: "Annual rent increases limited to 5% plus local CPI, or 10% maximum for covered properties.",
        },
        {
          title: "Just Cause Eviction",
          content: "After 12 months, tenants can only be evicted for enumerated 'just causes' with proper notice.",
        },
        {
          title: "Relocation Assistance",
          content: "No-fault evictions require payment of one month's rent as relocation assistance.",
        },
      ],
    },
    sortOrder: 4,
  },

  // VIRGINIA Compliance Cards
  {
    stateId: "VA",
    title: "Required Lease Disclosures",
    summary: "Virginia Residential Landlord and Tenant Act requires specific written disclosures",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Lead-Based Paint Disclosure",
          content: "Required for properties built before 1978 per federal law.",
        },
        {
          title: "Move-In Inspection Report",
          content: "Must provide written move-in inspection report within 5 days of occupancy.",
        },
        {
          title: "Mold Disclosure",
          content: "Must disclose visible mold contamination before lease signing.",
        },
        {
          title: "Defective Drywall Notice",
          content: "Must disclose if property contains defective drywall installed 2004-2007.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "VA",
    title: "Security Deposit Rules",
    summary: "Virginia limits deposits to 2 months and requires 45-day return under Va. Code § 55.1-1226",
    category: "deposits",
    content: {
      sections: [
        {
          title: "Maximum Deposit",
          content: "Security deposits cannot exceed 2 months' rent.",
        },
        {
          title: "45-Day Return Requirement",
          content: "Landlord must return deposit or provide itemized list within 45 days of move-out.",
        },
        {
          title: "Interest Not Required",
          content: "Virginia does not require landlords to pay interest on security deposits.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "VA",
    title: "Eviction Notice Requirements",
    summary: "Virginia law specifies notice periods and procedures for eviction proceedings",
    category: "evictions",
    content: {
      sections: [
        {
          title: "5-Day Pay or Quit",
          content: "For unpaid rent, serve 5-day notice to pay or quit before filing.",
        },
        {
          title: "21/30-Day Notice (Lease Violations)",
          content: "21-day notice for first violation with right to cure; 30-day for repeat violations.",
        },
        {
          title: "30-Day Termination Notice",
          content: "Month-to-month tenancies require 30-day written notice to terminate.",
        },
      ],
    },
    sortOrder: 3,
  },

  // NEVADA Compliance Cards
  {
    stateId: "NV",
    title: "Required Lease Disclosures",
    summary: "Nevada Revised Statutes require specific disclosures for residential leases",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Lead-Based Paint Disclosure",
          content: "Required for properties built before 1978 per federal requirements.",
        },
        {
          title: "Move-In Checklist",
          content: "Must provide move-in checklist documenting property condition at tenancy start.",
        },
        {
          title: "Foreclosure Status",
          content: "Must disclose if property is in foreclosure before signing lease.",
        },
        {
          title: "Landlord Contact Information",
          content: "Must provide name and address of landlord or authorized agent.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "NV",
    title: "Security Deposit Rules",
    summary: "Nevada limits deposits to 3 months and requires 30-day return under NRS 118A.242",
    category: "deposits",
    content: {
      sections: [
        {
          title: "Maximum Deposit",
          content: "Security deposits cannot exceed 3 months' rent.",
        },
        {
          title: "30-Day Return Requirement",
          content: "Landlord must return deposit or provide itemized statement within 30 days.",
        },
        {
          title: "Disposition Statement",
          content: "Written itemization of any deductions must be provided with remaining balance.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "NV",
    title: "Eviction Notice Requirements",
    summary: "Nevada law specifies notice periods for eviction proceedings under NRS 40.253-40.254",
    category: "evictions",
    content: {
      sections: [
        {
          title: "7-Day Pay or Quit",
          content: "For unpaid rent, serve 7-day judicial notice through constable or sheriff.",
        },
        {
          title: "5-Day Notice (Lease Violations)",
          content: "For lease violations, provide 5-day notice to cure or quit.",
        },
        {
          title: "30-Day Termination Notice",
          content: "Month-to-month tenancies require 30-day written notice to terminate.",
        },
      ],
    },
    sortOrder: 3,
  },

  // ARIZONA Compliance Cards
  {
    stateId: "AZ",
    title: "Required Lease Disclosures",
    summary: "Arizona Residential Landlord and Tenant Act requires specific written disclosures",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Lead-Based Paint Disclosure",
          content: "Required for properties built before 1978 per federal requirements.",
        },
        {
          title: "Move-In Inspection",
          content: "Must provide move-in inspection checklist for tenant to note existing conditions.",
        },
        {
          title: "Bed Bug Disclosure",
          content: "Must provide written educational materials about bed bugs at lease signing.",
        },
        {
          title: "Pool Safety Notice",
          content: "Properties with pools must provide pool safety notice per A.R.S. § 36-1681.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "AZ",
    title: "Security Deposit Rules",
    summary: "Arizona limits deposits to 1.5 months and requires 14-day return under A.R.S. § 33-1321",
    category: "deposits",
    content: {
      sections: [
        {
          title: "Maximum Deposit",
          content: "Security deposits cannot exceed 1.5 months' rent.",
        },
        {
          title: "14-Day Return Requirement",
          content: "Landlord must return deposit or provide itemized statement within 14 business days.",
        },
        {
          title: "Nonrefundable Fees",
          content: "Nonrefundable fees must be clearly labeled as such in writing.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "AZ",
    title: "Eviction Notice Requirements",
    summary: "Arizona law specifies notice periods for eviction proceedings under A.R.S. § 33-1368",
    category: "evictions",
    content: {
      sections: [
        {
          title: "5-Day Pay or Quit",
          content: "For unpaid rent, serve 5-day notice to pay or quit before filing eviction.",
        },
        {
          title: "10-Day Notice (Lease Violations)",
          content: "For curable lease violations, provide 10-day notice with right to cure.",
        },
        {
          title: "Immediate Eviction",
          content: "Immediate eviction allowed for serious violations like illegal activity or health hazards.",
        },
      ],
    },
    sortOrder: 3,
  },

  // FLORIDA Compliance Cards
  {
    stateId: "FL",
    title: "Required Lease Disclosures",
    summary: "Florida Statutes Chapter 83 requires specific disclosures for residential leases",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Lead-Based Paint Disclosure",
          content: "Required for properties built before 1978 per federal requirements.",
        },
        {
          title: "Radon Gas Disclosure",
          content: "Must include statutory radon gas disclosure language in all leases per F.S. § 404.056.",
        },
        {
          title: "Security Deposit Location",
          content: "Must disclose where deposit is held and whether interest will be paid.",
        },
        {
          title: "Landlord Contact Information",
          content: "Must provide name and address of landlord or authorized agent for notices.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "FL",
    title: "Security Deposit Rules",
    summary: "Florida has no deposit limit but strict return requirements under F.S. § 83.49",
    category: "deposits",
    content: {
      sections: [
        {
          title: "No State Limit",
          content: "Florida has no statutory limit on security deposit amounts.",
        },
        {
          title: "15/30-Day Return Requirement",
          content: "15 days if no deductions claimed; 30 days if claiming deductions with itemized notice.",
        },
        {
          title: "Written Notice Required",
          content: "If claiming deductions, must send written notice by certified mail within 30 days.",
        },
        {
          title: "Forfeiture for Non-Compliance",
          content: "Failure to give proper notice forfeits right to make any deductions.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "FL",
    title: "Eviction Notice Requirements",
    summary: "Florida law specifies notice periods for eviction proceedings under F.S. § 83.56",
    category: "evictions",
    content: {
      sections: [
        {
          title: "3-Day Pay or Quit",
          content: "For unpaid rent, serve 3-day notice to pay or vacate (excluding weekends/holidays).",
        },
        {
          title: "7-Day Notice (Lease Violations)",
          content: "For curable lease violations, provide 7-day notice with right to cure.",
        },
        {
          title: "7-Day Unconditional Quit",
          content: "For material non-curable violations, 7-day unconditional notice to vacate.",
        },
      ],
    },
    sortOrder: 3,
  },

  // ILLINOIS Compliance Cards
  {
    stateId: "IL",
    title: "Required Lease Disclosures",
    summary: "Illinois landlords must provide specific disclosures under state and local laws",
    category: "disclosures",
    content: {
      sections: [
        {
          title: "Lead-Based Paint Disclosure",
          content: "Required for properties built before 1978 per federal law. Must provide EPA pamphlet.",
        },
        {
          title: "Radon Disclosure",
          content: "Illinois Radon Awareness Act requires disclosure about radon hazards in all leases.",
        },
        {
          title: "Utility Disclosure",
          content: "Must disclose how utilities are billed if not separately metered to tenant.",
        },
        {
          title: "Carbon Monoxide Detector Notice",
          content: "Must provide written notice about carbon monoxide detectors per Illinois Carbon Monoxide Alarm Detector Act.",
        },
        {
          title: "Concession Disclosure",
          content: "Any rent concessions must be disclosed in writing in the lease agreement.",
        },
      ],
    },
    sortOrder: 1,
  },
  {
    stateId: "IL",
    title: "Security Deposit Rules",
    summary: "Illinois Security Deposit Return Act governs deposit limits and return timelines",
    category: "deposits",
    content: {
      sections: [
        {
          title: "Deposit Limit (5+ Units)",
          content: "For properties with 5+ units, deposit cannot exceed 1.5 months' rent.",
        },
        {
          title: "No State Limit (Under 5 Units)",
          content: "Properties with fewer than 5 units have no statutory deposit limit.",
        },
        {
          title: "30/45-Day Return Requirement",
          content: "Must return deposit within 30 days if no deductions; 45 days if itemized deductions provided.",
        },
        {
          title: "Itemized Statement Required",
          content: "Must provide itemized statement of deductions with estimated or actual costs within 30 days.",
        },
        {
          title: "Interest Requirement (Chicago)",
          content: "Chicago landlords must pay annual interest on security deposits per Chicago RLTO.",
        },
      ],
    },
    sortOrder: 2,
  },
  {
    stateId: "IL",
    title: "Eviction Notice Requirements",
    summary: "Illinois Forcible Entry and Detainer Act specifies notice periods and procedures",
    category: "evictions",
    content: {
      sections: [
        {
          title: "5-Day Notice (Non-Payment)",
          content: "For unpaid rent, serve 5-day notice to pay or quit. Must clearly state amount owed.",
        },
        {
          title: "10-Day Notice (Lease Violations)",
          content: "For lease violations, provide 10-day notice to cure or vacate.",
        },
        {
          title: "30-Day Notice (Month-to-Month)",
          content: "To terminate month-to-month tenancy, provide 30-day written notice.",
        },
        {
          title: "Court Filing Required",
          content: "Self-help evictions prohibited. Must file forcible entry and detainer lawsuit in court.",
        },
      ],
    },
    sortOrder: 3,
  },
  {
    stateId: "IL",
    title: "Fair Housing Protections",
    summary: "Illinois Human Rights Act provides broad fair housing protections beyond federal law",
    category: "fair_housing",
    content: {
      sections: [
        {
          title: "Protected Classes",
          content: "Illinois adds protections for sexual orientation, gender identity, military status, order of protection status, and ancestry.",
        },
        {
          title: "Source of Income Protection",
          content: "Cannot discriminate based on lawful source of income including housing vouchers (Section 8).",
        },
        {
          title: "Domestic Violence Survivor Protections",
          content: "Cannot refuse to rent or evict tenants solely due to domestic violence status.",
        },
        {
          title: "Chicago RLTO Additional Protections",
          content: "Chicago has additional tenant protections under the Residential Landlord and Tenant Ordinance.",
        },
      ],
    },
    sortOrder: 4,
  },
  {
    stateId: "IL",
    title: "Rent Increase Rules",
    summary: "Illinois has no statewide rent control but requires proper notice for increases",
    category: "rent_increases",
    content: {
      sections: [
        {
          title: "No Statewide Rent Control",
          content: "Illinois preempts local rent control ordinances—no municipal rent caps allowed.",
        },
        {
          title: "30-Day Notice Required",
          content: "For month-to-month tenancies, rent increases require 30-day advance written notice.",
        },
        {
          title: "Lease Term Increases",
          content: "Cannot increase rent during fixed lease term unless lease specifically allows it.",
        },
        {
          title: "Retaliatory Increase Prohibited",
          content: "Cannot increase rent in retaliation for tenant exercising legal rights or filing complaints.",
        },
      ],
    },
    sortOrder: 5,
  },
];

async function seedComplianceCards() {
  console.log(`🌱 Seeding ${comprehensiveComplianceCards.length} compliance cards...`);
  
  let upserted = 0;
  let errors = 0;

  for (const card of comprehensiveComplianceCards) {
    const key = generateComplianceKey(card.category, card.title);
    try {
      await db.insert(complianceCards)
        .values({
          ...card,
          key,
        })
        .onConflictDoUpdate({
          target: [complianceCards.stateId, complianceCards.key],
          set: {
            title: card.title,
            summary: card.summary,
            category: card.category,
            content: card.content,
            sortOrder: card.sortOrder,
            updatedAt: new Date(),
          },
        });
      console.log(`  ✓ ${card.title} (${card.stateId})`);
      upserted++;
    } catch (error: any) {
      console.error(`  ✗ ${card.title}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Compliance cards seeded: ${upserted} upserted, ${errors} errors`);
}

// Run if executed directly
seedComplianceCards()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Compliance card seeding failed:", error);
    process.exit(1);
  });
