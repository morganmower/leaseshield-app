import { db } from "./db";
import { templates } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

const NEW_STATES = ["WY", "CA", "VA", "NV", "AZ", "FL"];

const STATE_NAMES: Record<string, string> = {
  WY: "Wyoming",
  CA: "California", 
  VA: "Virginia",
  NV: "Nevada",
  AZ: "Arizona",
  FL: "Florida",
};

function getLeaseFormData(stateCode: string) {
  return {
    fields: [
      { id: "landlordName", type: "text", label: "Landlord Full Name", category: "Landlord Information", required: true },
      { id: "landlordAddress", type: "text", label: "Landlord Address", category: "Landlord Information", required: true },
      { id: "landlordPhone", type: "tel", label: "Landlord Phone", category: "Landlord Information", required: true },
      { id: "landlordEmail", type: "email", label: "Landlord Email", category: "Landlord Information", required: true },
      { id: "tenantName", type: "text", label: "Tenant Full Name", category: "Tenant Information", required: true },
      { id: "tenantEmail", type: "email", label: "Tenant Email", category: "Tenant Information", required: false },
      { id: "tenantPhone", type: "tel", label: "Tenant Phone", category: "Tenant Information", required: false },
      { id: "propertyAddress", type: "text", label: "Property Address", category: "Property Details", required: true },
      { id: "propertyCity", type: "text", label: "City", category: "Property Details", required: true },
      { id: "propertyState", type: "text", label: "State", category: "Property Details", required: true, defaultValue: STATE_NAMES[stateCode] },
      { id: "propertyZip", type: "text", label: "ZIP Code", category: "Property Details", required: true },
      { id: "monthlyRent", type: "currency", label: "Monthly Rent Amount", category: "Financial Terms", required: true },
      { id: "securityDeposit", type: "currency", label: "Security Deposit", category: "Financial Terms", required: true },
      { id: "lateFeeDays", type: "number", label: "Late Fee Grace Period (Days)", category: "Financial Terms", required: true, defaultValue: "5" },
      { id: "lateFeeAmount", type: "currency", label: "Late Fee Amount", category: "Financial Terms", required: true },
      { id: "leaseStartDate", type: "date", label: "Lease Start Date", category: "Lease Terms", required: true },
      { id: "leaseEndDate", type: "date", label: "Lease End Date", category: "Lease Terms", required: true },
      { id: "rentDueDay", type: "number", label: "Rent Due Day of Month", category: "Lease Terms", required: true, defaultValue: "1" },
    ]
  };
}

function getApplicationFormData() {
  return {
    fields: [
      { id: "applicantName", type: "text", label: "Applicant Full Name", category: "Personal Information", required: true },
      { id: "applicantDOB", type: "date", label: "Date of Birth", category: "Personal Information", required: true },
      { id: "applicantSSN", type: "text", label: "Social Security Number", category: "Personal Information", required: true },
      { id: "applicantPhone", type: "tel", label: "Phone Number", category: "Contact Information", required: true },
      { id: "applicantEmail", type: "email", label: "Email Address", category: "Contact Information", required: true },
      { id: "currentAddress", type: "text", label: "Current Address", category: "Residential History", required: true },
      { id: "currentLandlord", type: "text", label: "Current Landlord Name", category: "Residential History", required: false },
      { id: "currentLandlordPhone", type: "tel", label: "Current Landlord Phone", category: "Residential History", required: false },
      { id: "monthsAtCurrentAddress", type: "number", label: "Months at Current Address", category: "Residential History", required: true },
      { id: "employer", type: "text", label: "Current Employer", category: "Employment Information", required: true },
      { id: "employerPhone", type: "tel", label: "Employer Phone", category: "Employment Information", required: false },
      { id: "jobTitle", type: "text", label: "Job Title", category: "Employment Information", required: true },
      { id: "monthlyIncome", type: "currency", label: "Monthly Gross Income", category: "Employment Information", required: true },
      { id: "emergencyContact", type: "text", label: "Emergency Contact Name", category: "Emergency Contact", required: true },
      { id: "emergencyPhone", type: "tel", label: "Emergency Contact Phone", category: "Emergency Contact", required: true },
    ]
  };
}

function getMoveInFormData() {
  return {
    fields: [
      { id: "tenantName", type: "text", label: "Tenant Name", category: "General Information", required: true },
      { id: "propertyAddress", type: "text", label: "Property Address", category: "General Information", required: true },
      { id: "moveInDate", type: "date", label: "Move-In Date", category: "General Information", required: true },
      { id: "livingRoomCondition", type: "select", label: "Living Room Condition", category: "Room Conditions", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "livingRoomNotes", type: "textarea", label: "Living Room Notes", category: "Room Conditions", required: false },
      { id: "kitchenCondition", type: "select", label: "Kitchen Condition", category: "Room Conditions", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "kitchenNotes", type: "textarea", label: "Kitchen Notes", category: "Room Conditions", required: false },
      { id: "bedroomCondition", type: "select", label: "Bedroom Condition", category: "Room Conditions", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "bedroomNotes", type: "textarea", label: "Bedroom Notes", category: "Room Conditions", required: false },
      { id: "bathroomCondition", type: "select", label: "Bathroom Condition", category: "Room Conditions", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "bathroomNotes", type: "textarea", label: "Bathroom Notes", category: "Room Conditions", required: false },
      { id: "keysProvided", type: "number", label: "Number of Keys Provided", category: "Keys & Access", required: true },
      { id: "additionalNotes", type: "textarea", label: "Additional Notes", category: "Other", required: false },
    ]
  };
}

function getMoveOutFormData() {
  return {
    fields: [
      { id: "tenantName", type: "text", label: "Tenant Name", category: "General Information", required: true },
      { id: "propertyAddress", type: "text", label: "Property Address", category: "General Information", required: true },
      { id: "moveOutDate", type: "date", label: "Move-Out Date", category: "General Information", required: true },
      { id: "livingRoomCondition", type: "select", label: "Living Room Condition", category: "Room Conditions", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "livingRoomDamages", type: "textarea", label: "Living Room Damages", category: "Room Conditions", required: false },
      { id: "kitchenCondition", type: "select", label: "Kitchen Condition", category: "Room Conditions", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "kitchenDamages", type: "textarea", label: "Kitchen Damages", category: "Room Conditions", required: false },
      { id: "bedroomCondition", type: "select", label: "Bedroom Condition", category: "Room Conditions", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "bedroomDamages", type: "textarea", label: "Bedroom Damages", category: "Room Conditions", required: false },
      { id: "bathroomCondition", type: "select", label: "Bathroom Condition", category: "Room Conditions", required: true, options: ["Excellent", "Good", "Fair", "Poor"] },
      { id: "bathroomDamages", type: "textarea", label: "Bathroom Damages", category: "Room Conditions", required: false },
      { id: "keysReturned", type: "number", label: "Number of Keys Returned", category: "Keys & Access", required: true },
      { id: "cleaningRequired", type: "checkbox", label: "Professional Cleaning Required", category: "Deductions", required: false },
      { id: "estimatedDeductions", type: "currency", label: "Estimated Deductions", category: "Deductions", required: false },
      { id: "depositRefundAmount", type: "currency", label: "Deposit Refund Amount", category: "Deductions", required: false },
    ]
  };
}

function getNoticeFormData(stateCode: string) {
  return {
    fields: [
      { id: "landlordName", type: "text", label: "Landlord Name", category: "Landlord Information", required: true },
      { id: "landlordAddress", type: "text", label: "Landlord Address", category: "Landlord Information", required: true },
      { id: "tenantName", type: "text", label: "Tenant Name", category: "Tenant Information", required: true },
      { id: "propertyAddress", type: "text", label: "Property Address", category: "Property Details", required: true },
      { id: "propertyCity", type: "text", label: "City", category: "Property Details", required: true },
      { id: "propertyState", type: "text", label: "State", category: "Property Details", required: true, defaultValue: STATE_NAMES[stateCode] },
      { id: "propertyZip", type: "text", label: "ZIP Code", category: "Property Details", required: true },
      { id: "noticeDate", type: "date", label: "Date of Notice", category: "Notice Details", required: true },
      { id: "amountOwed", type: "currency", label: "Amount Owed", category: "Notice Details", required: false },
      { id: "violationDescription", type: "textarea", label: "Description of Violation/Issue", category: "Notice Details", required: true },
      { id: "cureDeadline", type: "date", label: "Deadline to Cure/Pay", category: "Notice Details", required: true },
    ]
  };
}

async function updateTemplatesWithFormData() {
  console.log("🔧 Adding fillable form data to new state templates...\n");

  for (const stateCode of NEW_STATES) {
    console.log(`\n📍 Processing ${STATE_NAMES[stateCode]} (${stateCode})...`);

    const stateTemplates = await db.select().from(templates)
      .where(and(
        eq(templates.stateId, stateCode),
        eq(templates.isActive, true)
      ));

    for (const template of stateTemplates) {
      let formData = null;

      if (template.templateType === "lease") {
        formData = getLeaseFormData(stateCode);
      } else if (template.templateType === "application") {
        formData = getApplicationFormData();
      } else if (template.templateType === "move_in_checklist") {
        formData = getMoveInFormData();
      } else if (template.templateType === "move_out_checklist") {
        formData = getMoveOutFormData();
      } else if (template.templateType === "late_rent_notice" || 
                 template.templateType === "lease_violation_notice" ||
                 template.templateType === "eviction_notice") {
        formData = getNoticeFormData(stateCode);
      }

      if (formData) {
        await db.update(templates)
          .set({ fillableFormData: formData })
          .where(eq(templates.id, template.id));
        console.log(`  ✅ Updated: ${template.title}`);
      } else {
        console.log(`  ⚠️ Skipped (unknown type): ${template.title} (${template.templateType})`);
      }
    }
  }

  console.log("\n✅ All new state templates now have fillable form data!");
}

updateTemplatesWithFormData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error updating templates:", error);
    process.exit(1);
  });
