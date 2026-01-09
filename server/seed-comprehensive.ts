import { db } from "./db";
import { templates } from "@shared/schema";
import { generateTemplateKey } from "./utils/seedHelpers";

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

  // WYOMING - Leasing
  {
    title: "Wyoming Residential Lease Agreement",
    description: "Professional lease with all Wyoming-required disclosures including meth contamination notice",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "WY",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Agreement (WY)",
    description: "Flexible rental agreement compliant with Wyoming termination requirements",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "WY",
    version: 1,
    sortOrder: 2,
  },
  // WYOMING - Screening
  {
    title: "Wyoming Rental Application",
    description: "Fair Housing-compliant application for Wyoming landlords",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "WY",
    version: 1,
    sortOrder: 10,
  },
  // WYOMING - Move In/Out
  {
    title: "Move-In Inspection Form (WY)",
    description: "Property condition checklist for Wyoming rentals",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "WY",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Move-Out Inspection Form (WY)",
    description: "Final walkthrough documentation for Wyoming properties",
    category: "move_in_out" as const,
    templateType: "move_out_checklist" as const,
    stateId: "WY",
    version: 1,
    sortOrder: 21,
  },
  {
    title: "Security Deposit Itemization (WY)",
    description: "Wyoming's 30-day deduction itemization notice",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "WY",
    version: 1,
    sortOrder: 22,
  },
  // WYOMING - Notices
  {
    title: "3-Day Notice to Pay or Quit (WY)",
    description: "Wyoming's required notice for non-payment of rent",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "WY",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "3-Day Lease Violation Notice (WY)",
    description: "Notice to cure lease violations per Wyoming law",
    category: "notices" as const,
    templateType: "lease_violation_notice" as const,
    stateId: "WY",
    version: 1,
    sortOrder: 31,
  },

  // CALIFORNIA - Leasing
  {
    title: "California Residential Lease Agreement",
    description: "Comprehensive lease with all California Civil Code disclosures including rent control notices",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "CA",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Agreement (CA)",
    description: "Flexible rental agreement with California tenant protection disclosures",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "CA",
    version: 1,
    sortOrder: 2,
  },
  // CALIFORNIA - Screening
  {
    title: "California Rental Application",
    description: "Fair Housing-compliant application meeting California requirements",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "CA",
    version: 1,
    sortOrder: 10,
  },
  // CALIFORNIA - Move In/Out
  {
    title: "Move-In Inspection Form (CA)",
    description: "Property condition checklist for California rentals",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "CA",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Move-Out Inspection Form (CA)",
    description: "Final walkthrough documentation per California requirements",
    category: "move_in_out" as const,
    templateType: "move_out_checklist" as const,
    stateId: "CA",
    version: 1,
    sortOrder: 21,
  },
  {
    title: "Security Deposit Itemization (CA)",
    description: "California's 21-day itemized deduction statement",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "CA",
    version: 1,
    sortOrder: 22,
  },
  // CALIFORNIA - Notices
  {
    title: "3-Day Notice to Pay or Quit (CA)",
    description: "California's required notice for non-payment of rent",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "CA",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "3-Day Lease Violation Notice (CA)",
    description: "Notice to cure lease violations per California Civil Code",
    category: "notices" as const,
    templateType: "lease_violation_notice" as const,
    stateId: "CA",
    version: 1,
    sortOrder: 31,
  },

  // VIRGINIA - Leasing
  {
    title: "Virginia Residential Lease Agreement",
    description: "Professional lease with all Virginia Landlord Tenant Act disclosures",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "VA",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Agreement (VA)",
    description: "Flexible rental agreement compliant with Virginia requirements",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "VA",
    version: 1,
    sortOrder: 2,
  },
  // VIRGINIA - Screening
  {
    title: "Virginia Rental Application",
    description: "Fair Housing-compliant application for Virginia landlords",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "VA",
    version: 1,
    sortOrder: 10,
  },
  // VIRGINIA - Move In/Out
  {
    title: "Move-In Inspection Form (VA)",
    description: "Virginia's required move-in inspection checklist",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "VA",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Move-Out Inspection Form (VA)",
    description: "Final walkthrough documentation for Virginia properties",
    category: "move_in_out" as const,
    templateType: "move_out_checklist" as const,
    stateId: "VA",
    version: 1,
    sortOrder: 21,
  },
  {
    title: "Security Deposit Itemization (VA)",
    description: "Virginia's 45-day deduction itemization notice",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "VA",
    version: 1,
    sortOrder: 22,
  },
  // VIRGINIA - Notices
  {
    title: "5-Day Notice to Pay or Quit (VA)",
    description: "Virginia's required notice for non-payment of rent",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "VA",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "21-Day Lease Violation Notice (VA)",
    description: "Notice to cure lease violations per Virginia law",
    category: "notices" as const,
    templateType: "lease_violation_notice" as const,
    stateId: "VA",
    version: 1,
    sortOrder: 31,
  },

  // NEVADA - Leasing
  {
    title: "Nevada Residential Lease Agreement",
    description: "Professional lease with all Nevada NRS Chapter 118A disclosures",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "NV",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Agreement (NV)",
    description: "Flexible rental agreement compliant with Nevada requirements",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "NV",
    version: 1,
    sortOrder: 2,
  },
  // NEVADA - Screening
  {
    title: "Nevada Rental Application",
    description: "Fair Housing-compliant application for Nevada landlords",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "NV",
    version: 1,
    sortOrder: 10,
  },
  // NEVADA - Move In/Out
  {
    title: "Move-In Inspection Form (NV)",
    description: "Nevada's required move-in condition checklist",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "NV",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Move-Out Inspection Form (NV)",
    description: "Final walkthrough documentation for Nevada properties",
    category: "move_in_out" as const,
    templateType: "move_out_checklist" as const,
    stateId: "NV",
    version: 1,
    sortOrder: 21,
  },
  {
    title: "Security Deposit Itemization (NV)",
    description: "Nevada's 30-day deduction itemization statement",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "NV",
    version: 1,
    sortOrder: 22,
  },
  // NEVADA - Notices
  {
    title: "7-Day Notice to Pay or Quit (NV)",
    description: "Nevada's required judicial notice for non-payment",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "NV",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "5-Day Lease Violation Notice (NV)",
    description: "Notice to cure lease violations per Nevada law",
    category: "notices" as const,
    templateType: "lease_violation_notice" as const,
    stateId: "NV",
    version: 1,
    sortOrder: 31,
  },

  // ARIZONA - Leasing
  {
    title: "Arizona Residential Lease Agreement",
    description: "Professional lease with all Arizona ARLTA disclosures including pool safety",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "AZ",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Agreement (AZ)",
    description: "Flexible rental agreement compliant with Arizona requirements",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "AZ",
    version: 1,
    sortOrder: 2,
  },
  // ARIZONA - Screening
  {
    title: "Arizona Rental Application",
    description: "Fair Housing-compliant application for Arizona landlords",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "AZ",
    version: 1,
    sortOrder: 10,
  },
  // ARIZONA - Move In/Out
  {
    title: "Move-In Inspection Form (AZ)",
    description: "Arizona's required move-in condition checklist",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "AZ",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Move-Out Inspection Form (AZ)",
    description: "Final walkthrough documentation for Arizona properties",
    category: "move_in_out" as const,
    templateType: "move_out_checklist" as const,
    stateId: "AZ",
    version: 1,
    sortOrder: 21,
  },
  {
    title: "Security Deposit Itemization (AZ)",
    description: "Arizona's 14-business-day deduction statement",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "AZ",
    version: 1,
    sortOrder: 22,
  },
  // ARIZONA - Notices
  {
    title: "5-Day Notice to Pay or Quit (AZ)",
    description: "Arizona's required notice for non-payment of rent",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "AZ",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "10-Day Lease Violation Notice (AZ)",
    description: "Notice to cure lease violations per Arizona ARLTA",
    category: "notices" as const,
    templateType: "lease_violation_notice" as const,
    stateId: "AZ",
    version: 1,
    sortOrder: 31,
  },

  // FLORIDA - Leasing
  {
    title: "Florida Residential Lease Agreement",
    description: "Professional lease with all Florida Chapter 83 disclosures including radon notice",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "FL",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Agreement (FL)",
    description: "Flexible rental agreement compliant with Florida requirements",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "FL",
    version: 1,
    sortOrder: 2,
  },
  // FLORIDA - Screening
  {
    title: "Florida Rental Application",
    description: "Fair Housing-compliant application for Florida landlords",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "FL",
    version: 1,
    sortOrder: 10,
  },
  // FLORIDA - Move In/Out
  {
    title: "Move-In Inspection Form (FL)",
    description: "Property condition checklist for Florida rentals",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "FL",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Move-Out Inspection Form (FL)",
    description: "Final walkthrough documentation for Florida properties",
    category: "move_in_out" as const,
    templateType: "move_out_checklist" as const,
    stateId: "FL",
    version: 1,
    sortOrder: 21,
  },
  {
    title: "Security Deposit Itemization (FL)",
    description: "Florida's 15/30-day deduction itemization notice",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "FL",
    version: 1,
    sortOrder: 22,
  },
  // FLORIDA - Notices
  {
    title: "3-Day Notice to Pay or Vacate (FL)",
    description: "Florida's required notice for non-payment of rent",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "FL",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "7-Day Lease Violation Notice (FL)",
    description: "Notice to cure lease violations per Florida Statutes",
    category: "notices" as const,
    templateType: "lease_violation_notice" as const,
    stateId: "FL",
    version: 1,
    sortOrder: 31,
  },

  // ILLINOIS - Leasing
  {
    title: "Illinois Residential Lease Agreement",
    description: "Comprehensive lease with all Illinois disclosures including radon and security deposit notices",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "IL",
    version: 1,
    sortOrder: 1,
  },
  {
    title: "Month-to-Month Agreement (IL)",
    description: "Flexible rental agreement compliant with Illinois requirements",
    category: "leasing" as const,
    templateType: "lease" as const,
    stateId: "IL",
    version: 1,
    sortOrder: 2,
  },
  // ILLINOIS - Screening
  {
    title: "Illinois Rental Application",
    description: "Fair Housing-compliant application meeting Illinois Human Rights Act requirements",
    category: "screening" as const,
    templateType: "application" as const,
    stateId: "IL",
    version: 1,
    sortOrder: 10,
  },
  // ILLINOIS - Move In/Out
  {
    title: "Move-In Inspection Form (IL)",
    description: "Property condition checklist for Illinois rentals",
    category: "move_in_out" as const,
    templateType: "move_in_checklist" as const,
    stateId: "IL",
    version: 1,
    sortOrder: 20,
  },
  {
    title: "Move-Out Inspection Form (IL)",
    description: "Final walkthrough documentation for Illinois properties",
    category: "move_in_out" as const,
    templateType: "move_out_checklist" as const,
    stateId: "IL",
    version: 1,
    sortOrder: 21,
  },
  {
    title: "Security Deposit Itemization (IL)",
    description: "Illinois 30/45-day itemized deduction statement per Security Deposit Return Act",
    category: "move_in_out" as const,
    templateType: "deposit_itemization" as const,
    stateId: "IL",
    version: 1,
    sortOrder: 22,
  },
  // ILLINOIS - Notices
  {
    title: "5-Day Notice to Pay or Quit (IL)",
    description: "Illinois required notice for non-payment of rent per Forcible Entry and Detainer Act",
    category: "notices" as const,
    templateType: "late_rent_notice" as const,
    stateId: "IL",
    version: 1,
    sortOrder: 30,
  },
  {
    title: "10-Day Lease Violation Notice (IL)",
    description: "Notice to cure lease violations per Illinois law",
    category: "notices" as const,
    templateType: "lease_violation_notice" as const,
    stateId: "IL",
    version: 1,
    sortOrder: 31,
  },
];

async function seedComprehensiveTemplates() {
  console.log(`🌱 Seeding ${comprehensiveTemplates.length} comprehensive templates...`);
  
  let upserted = 0;
  let errors = 0;

  for (const template of comprehensiveTemplates) {
    const key = generateTemplateKey(template.category, template.templateType, template.title);
    const version = template.version ?? 1;
    try {
      await db.insert(templates)
        .values({
          ...template,
          key,
          version,
        })
        .onConflictDoUpdate({
          target: [templates.stateId, templates.key, templates.version],
          set: {
            title: template.title,
            description: template.description,
            category: template.category,
            templateType: template.templateType,
            sortOrder: template.sortOrder,
            updatedAt: new Date(),
          },
        });
      console.log(`  ✓ ${template.title} (${template.stateId})`);
      upserted++;
    } catch (error: any) {
      console.error(`  ✗ ${template.title}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Templates seeded: ${upserted} upserted, ${errors} errors`);
}

// Run if executed directly
seedComprehensiveTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Template seeding failed:", error);
    process.exit(1);
  });
