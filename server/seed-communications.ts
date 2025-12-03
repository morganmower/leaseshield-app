import { db } from "./db";
import { communicationTemplates } from "@shared/schema";

const NEW_STATES = ["WY", "CA", "VA", "NV", "AZ", "FL"];

const STATE_NAMES: Record<string, string> = {
  WY: "Wyoming",
  CA: "California",
  VA: "Virginia",
  NV: "Nevada",
  AZ: "Arizona",
  FL: "Florida",
};

const STATE_CODES: Record<string, string> = {
  WY: "Wyoming Statutes",
  CA: "California Civil Code",
  VA: "Virginia Code",
  NV: "Nevada Revised Statutes",
  AZ: "Arizona Revised Statutes",
  FL: "Florida Statutes",
};

function getTemplates(stateCode: string) {
  const stateName = STATE_NAMES[stateCode];
  const stateCodeRef = STATE_CODES[stateCode];

  return [
    {
      stateId: stateCode,
      templateType: "rent_reminder",
      title: "Professional Rent Reminder",
      bodyText: `Dear {{tenant_name}},

This is a reminder that rent of {{amount_due}} is due on {{due_date}} for {{property_name}}.

Please submit payment to: {{landlord_address}}

Thank you for your prompt attention.

{{landlord_name}}`,
      isActive: true,
    },
    {
      stateId: stateCode,
      templateType: "welcome_letter",
      title: `${stateName} Welcome Letter`,
      bodyText: `Welcome to {{property_name}}!

Dear {{tenant_name}},

We welcome you as our tenant under the ${stateCodeRef}. Your lease begins {{move_in_date}} with monthly rent of {{amount_due}}.

Under ${stateName} law, this property is maintained to a habitable standard. All maintenance requests should be submitted in writing to {{landlord_email}}.

If you have questions, contact us at {{landlord_phone}}.

Best regards,
{{landlord_name}}`,
      isActive: true,
    },
    {
      stateId: stateCode,
      templateType: "lease_renewal_notice",
      title: `${stateName} Lease Renewal Notice`,
      bodyText: `Dear {{tenant_name}},

Your lease at {{property_name}} expires on {{lease_end_date}}. We would like to offer you a renewal.

New Terms:
- Monthly Rent: {{new_rent_amount}}
- Lease Period: {{new_lease_start}} to {{new_lease_end}}

Please respond by {{response_deadline}} to confirm your interest in renewing.

If you have questions, contact us at {{landlord_phone}}.

Sincerely,
{{landlord_name}}`,
      isActive: true,
    },
    {
      stateId: stateCode,
      templateType: "late_payment_notice",
      title: `${stateName} Late Payment Notice`,
      bodyText: `Dear {{tenant_name}},

This notice is to inform you that rent for {{property_name}} is past due.

Amount Due: {{amount_due}}
Original Due Date: {{due_date}}
Late Fee Applied: {{late_fee_amount}}
Total Amount Now Due: {{total_due}}

Please remit payment immediately to avoid further action. Under ${stateName} law, continued non-payment may result in legal proceedings.

Contact us at {{landlord_phone}} if you need to discuss payment arrangements.

{{landlord_name}}`,
      isActive: true,
    },
    {
      stateId: stateCode,
      templateType: "move_in_welcome",
      title: `${stateName} Move-In Welcome Package`,
      bodyText: `Welcome to Your New Home!

Dear {{tenant_name}},

Congratulations on your new residence at {{property_name}}! Here's important information for your move-in:

Move-In Date: {{move_in_date}}
Key Pickup: {{key_pickup_location}}
Contact: {{landlord_phone}}

Important Information:
- Utilities: Please contact local utility providers to transfer service to your name
- Parking: Your assigned space is {{parking_space}}
- Emergency Contact: {{emergency_contact}}

Enclosed with this letter:
- Move-In Inspection Checklist
- Copy of Lease Agreement
- ${stateName} Tenant Rights Information

Welcome to the community!

{{landlord_name}}`,
      isActive: true,
    },
  ];
}

async function seedCommunicationTemplates() {
  console.log("🔧 Adding communication templates for new states...\n");

  for (const stateCode of NEW_STATES) {
    console.log(`\n📍 Processing ${STATE_NAMES[stateCode]} (${stateCode})...`);

    const templates = getTemplates(stateCode);

    for (const template of templates) {
      try {
        await db.insert(communicationTemplates).values(template);
        console.log(`  ✅ Created: ${template.title}`);
      } catch (error: any) {
        if (error.code === "23505") {
          console.log(`  ⏭️  Skipped (exists): ${template.title}`);
        } else {
          console.error(`  ❌ Error: ${template.title}`, error.message);
        }
      }
    }
  }

  console.log("\n✅ Communication templates seeding complete!");
}

seedCommunicationTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error seeding communication templates:", error);
    process.exit(1);
  });
