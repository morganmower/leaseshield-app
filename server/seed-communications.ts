import { db } from "./db";
import { communicationTemplates } from "@shared/schema";

import { generateCommunicationKey } from "./utils/seedHelpers";
import { getActiveStateIds } from "./states";
import { getStateNames } from "./states/getStateName";

const STATE_STATUTE_REFS: Record<string, string> = {
  UT: "Utah Code",
  TX: "Texas Property Code",
  ND: "North Dakota Century Code",
  SD: "South Dakota Codified Laws",
  NC: "North Carolina General Statutes",
  OH: "Ohio Revised Code",
  MI: "Michigan Compiled Laws",
  ID: "Idaho Code",
  WY: "Wyoming Statutes",
  CA: "California Civil Code",
  VA: "Virginia Code",
  NV: "Nevada Revised Statutes",
  AZ: "Arizona Revised Statutes",
  FL: "Florida Statutes",
  IL: "Illinois Compiled Statutes",
};

function getTemplates(stateCode: string, stateName: string) {
  const stateCodeRef = STATE_STATUTE_REFS[stateCode] || `${stateName} state law`;

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
  console.log("🔧 Adding communication templates for all active states...\n");

  const activeStates = await getActiveStateIds();
  const stateNames = await getStateNames();
  let upserted = 0;
  let errors = 0;

  for (const stateCode of activeStates) {
    const stateName = stateNames[stateCode];
    if (!stateName) {
      console.log(`  ⏭️  Skipping ${stateCode} (no state name in database)`);
      continue;
    }
    console.log(`\n📍 Processing ${stateName} (${stateCode})...`);

    const templates = getTemplates(stateCode, stateName);

    for (const template of templates) {
      const key = generateCommunicationKey(template.templateType, template.title);
      try {
        await db.insert(communicationTemplates)
          .values({
            ...template,
            key,
            templateType: template.templateType as "rent_reminder" | "welcome_letter" | "lease_renewal_notice" | "late_payment_notice" | "move_in_welcome",
          })
          .onConflictDoUpdate({
            target: [communicationTemplates.stateId, communicationTemplates.templateType, communicationTemplates.key],
            set: {
              title: template.title,
              bodyText: template.bodyText,
              isActive: template.isActive,
              updatedAt: new Date(),
            },
          });
        console.log(`  ✓ ${template.title}`);
        upserted++;
      } catch (error: any) {
        console.error(`  ✗ ${template.title}: ${error.message}`);
        errors++;
      }
    }
  }

  console.log(`\n✅ Communication templates seeded: ${upserted} upserted, ${errors} errors`);
}

seedCommunicationTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error seeding communication templates:", error);
    process.exit(1);
  });
