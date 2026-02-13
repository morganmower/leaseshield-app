/**
 * Seed script for high-risk jurisdiction denial rules
 * 
 * This script populates:
 * 1. Cities with Fair Chance Housing or Source of Income protections
 * 2. Counties with special screening rules (e.g., Cook County)
 * 3. State-level source of income protections (e.g., Virginia)
 * 4. Denial criteria rules for each jurisdiction
 * 
 * Run with: npx tsx server/scripts/seedJurisdictionRules.ts
 */

import { db } from '../db';
import { cities, counties, denialCriteria, denialCriteriaRules, states } from '../../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

interface JurisdictionSeed {
  name: string;
  stateId: string;
  type: 'city' | 'county' | 'state';
  rules: {
    criteriaCode: string;
    status: 'blocked' | 'allowed' | 'conditional';
    explanationPlain: string;
    whyItMatters?: string;
    legalAlternative?: string;
    requiredSteps?: string[];
    statuteCitation?: string;
  }[];
}

// High-risk jurisdictions with their rules
const jurisdictionSeeds: JurisdictionSeed[] = [
  // ===== MICHIGAN - Fair Chance Housing (Criminal History) =====
  {
    name: 'Ann Arbor',
    stateId: 'MI',
    type: 'city',
    rules: [
      {
        criteriaCode: 'CRIM_ARREST',
        status: 'blocked',
        explanationPlain: 'Ann Arbor prohibits using criminal history in tenant selection with limited exceptions.',
        whyItMatters: 'This city has one of the strongest Fair Chance Housing ordinances in the country.',
        statuteCitation: 'Ann Arbor Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_RECENT',
        status: 'blocked',
        explanationPlain: 'Ann Arbor prohibits using criminal history in tenant selection with limited exceptions.',
        whyItMatters: 'Only very narrow exceptions apply (sex offenses, methamphetamine production on premises).',
        statuteCitation: 'Ann Arbor Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_OLD',
        status: 'blocked',
        explanationPlain: 'Ann Arbor prohibits using criminal history in tenant selection.',
        statuteCitation: 'Ann Arbor Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_SEALED_EXPUNGED',
        status: 'blocked',
        explanationPlain: 'Sealed and expunged records cannot be used anywhere, including Ann Arbor.',
        statuteCitation: 'Ann Arbor Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_FELONY',
        status: 'blocked',
        explanationPlain: 'Ann Arbor prohibits using criminal history including felonies in tenant selection.',
        statuteCitation: 'Ann Arbor Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_MISDEMEANOR',
        status: 'blocked',
        explanationPlain: 'Ann Arbor prohibits using criminal history including misdemeanors in tenant selection.',
        statuteCitation: 'Ann Arbor Fair Chance Housing Ordinance',
      },
    ],
  },
  {
    name: 'Detroit',
    stateId: 'MI',
    type: 'city',
    rules: [
      {
        criteriaCode: 'CRIM_ARREST',
        status: 'blocked',
        explanationPlain: 'Detroit prohibits using arrest records in tenant screening.',
        whyItMatters: 'Arrests without convictions cannot be used as denial criteria.',
        statuteCitation: 'Detroit Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_RECENT',
        status: 'conditional',
        explanationPlain: 'Detroit delays criminal history review until after a conditional lease offer.',
        whyItMatters: 'You must make a conditional offer first, then conduct background check.',
        requiredSteps: ['conditional_offer', 'individualized_assessment'],
        statuteCitation: 'Detroit Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_OLD',
        status: 'conditional',
        explanationPlain: 'Detroit delays criminal history review until after a conditional lease offer.',
        requiredSteps: ['conditional_offer', 'individualized_assessment'],
        statuteCitation: 'Detroit Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_FELONY',
        status: 'conditional',
        explanationPlain: 'Detroit delays criminal history review until after a conditional lease offer.',
        requiredSteps: ['conditional_offer', 'individualized_assessment'],
        statuteCitation: 'Detroit Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_MISDEMEANOR',
        status: 'conditional',
        explanationPlain: 'Detroit delays criminal history review until after a conditional lease offer.',
        requiredSteps: ['conditional_offer', 'individualized_assessment'],
        statuteCitation: 'Detroit Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_SEALED_EXPUNGED',
        status: 'blocked',
        explanationPlain: 'Sealed and expunged records cannot be used.',
        statuteCitation: 'Detroit Fair Chance Housing Ordinance',
      },
    ],
  },
  {
    name: 'Jackson',
    stateId: 'MI',
    type: 'city',
    rules: [
      {
        criteriaCode: 'CRIM_ARREST',
        status: 'blocked',
        explanationPlain: 'Jackson bans asking about criminal history during initial screening.',
        statuteCitation: 'Jackson Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_RECENT',
        status: 'conditional',
        explanationPlain: 'Jackson postpones background check until a conditional lease is offered.',
        requiredSteps: ['conditional_offer'],
        statuteCitation: 'Jackson Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_OLD',
        status: 'conditional',
        explanationPlain: 'Jackson postpones background check until a conditional lease is offered.',
        requiredSteps: ['conditional_offer'],
        statuteCitation: 'Jackson Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_FELONY',
        status: 'conditional',
        explanationPlain: 'Jackson postpones background check until a conditional lease is offered.',
        requiredSteps: ['conditional_offer'],
        statuteCitation: 'Jackson Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_MISDEMEANOR',
        status: 'conditional',
        explanationPlain: 'Jackson postpones background check until a conditional lease is offered.',
        requiredSteps: ['conditional_offer'],
        statuteCitation: 'Jackson Fair Chance Housing Ordinance',
      },
    ],
  },
  {
    name: 'Flint',
    stateId: 'MI',
    type: 'city',
    rules: [
      {
        criteriaCode: 'CRIM_ARREST',
        status: 'blocked',
        explanationPlain: 'Flint has Fair Chance Housing protections limiting criminal history use.',
        statuteCitation: 'Flint Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_RECENT',
        status: 'conditional',
        explanationPlain: 'Flint requires individualized assessment before using criminal history.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'Flint Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_OLD',
        status: 'conditional',
        explanationPlain: 'Flint requires individualized assessment before using criminal history.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'Flint Fair Chance Housing Ordinance',
      },
    ],
  },

  // ===== CALIFORNIA - Fair Chance Housing (Criminal History) =====
  {
    name: 'Oakland',
    stateId: 'CA',
    type: 'city',
    rules: [
      {
        criteriaCode: 'CRIM_ARREST',
        status: 'blocked',
        explanationPlain: 'Oakland prohibits screening criminal history during advertising, application, or selection.',
        whyItMatters: 'Oakland has one of the strongest restrictions - criminal history screening is generally prohibited.',
        statuteCitation: 'Oakland Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_RECENT',
        status: 'blocked',
        explanationPlain: 'Oakland prohibits screening criminal history during tenant selection.',
        statuteCitation: 'Oakland Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_OLD',
        status: 'blocked',
        explanationPlain: 'Oakland prohibits screening criminal history during tenant selection.',
        statuteCitation: 'Oakland Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_FELONY',
        status: 'blocked',
        explanationPlain: 'Oakland prohibits screening criminal history including felonies.',
        statuteCitation: 'Oakland Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_MISDEMEANOR',
        status: 'blocked',
        explanationPlain: 'Oakland prohibits screening criminal history including misdemeanors.',
        statuteCitation: 'Oakland Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_SEALED_EXPUNGED',
        status: 'blocked',
        explanationPlain: 'Sealed and expunged records cannot be used.',
        statuteCitation: 'Oakland Fair Chance Housing Ordinance',
      },
    ],
  },
  {
    name: 'Berkeley',
    stateId: 'CA',
    type: 'city',
    rules: [
      {
        criteriaCode: 'CRIM_ARREST',
        status: 'blocked',
        explanationPlain: 'Berkeley has ban-the-box style housing rules restricting criminal history screening.',
        statuteCitation: 'Berkeley Fair Chance Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_RECENT',
        status: 'conditional',
        explanationPlain: 'Berkeley restricts criminal history screening with fair chance protections.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'Berkeley Fair Chance Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_OLD',
        status: 'conditional',
        explanationPlain: 'Berkeley restricts criminal history screening with fair chance protections.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'Berkeley Fair Chance Ordinance',
      },
    ],
  },
  {
    name: 'San Francisco',
    stateId: 'CA',
    type: 'city',
    rules: [
      {
        criteriaCode: 'CRIM_ARREST',
        status: 'blocked',
        explanationPlain: 'San Francisco has fair chance protections, particularly for affordable housing providers.',
        statuteCitation: 'San Francisco Fair Chance Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_RECENT',
        status: 'conditional',
        explanationPlain: 'San Francisco requires individualized assessment for criminal history.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'San Francisco Fair Chance Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_OLD',
        status: 'conditional',
        explanationPlain: 'San Francisco requires individualized assessment for criminal history.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'San Francisco Fair Chance Ordinance',
      },
    ],
  },
  {
    name: 'Los Angeles',
    stateId: 'CA',
    type: 'city',
    rules: [
      {
        criteriaCode: 'CRIM_ARREST',
        status: 'blocked',
        explanationPlain: 'Los Angeles Fair Chance Housing Ordinance prohibits using arrest records.',
        statuteCitation: 'LA Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_RECENT',
        status: 'conditional',
        explanationPlain: 'LA requires conditional offer before criminal history review, plus individualized assessment.',
        requiredSteps: ['conditional_offer', 'individualized_assessment'],
        statuteCitation: 'LA Fair Chance Housing Ordinance',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_OLD',
        status: 'conditional',
        explanationPlain: 'LA requires conditional offer before criminal history review, plus individualized assessment.',
        requiredSteps: ['conditional_offer', 'individualized_assessment'],
        statuteCitation: 'LA Fair Chance Housing Ordinance',
      },
    ],
  },

  // ===== ILLINOIS - Cook County =====
  {
    name: 'Cook County',
    stateId: 'IL',
    type: 'county',
    rules: [
      {
        criteriaCode: 'CRIM_ARREST',
        status: 'blocked',
        explanationPlain: 'Cook County Just Housing Amendment prohibits denial based on arrest records.',
        whyItMatters: 'Arrests without convictions cannot be used to deny housing.',
        statuteCitation: 'Cook County Just Housing Amendment',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_RECENT',
        status: 'conditional',
        explanationPlain: 'Cook County requires individualized assessment before denying for criminal history.',
        whyItMatters: 'You must consider rehabilitation, time since offense, and relevance to housing.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'Cook County Just Housing Amendment',
      },
      {
        criteriaCode: 'CRIM_CONVICTION_OLD',
        status: 'conditional',
        explanationPlain: 'Cook County requires individualized assessment for all criminal history.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'Cook County Just Housing Amendment',
      },
      {
        criteriaCode: 'CRIM_FELONY',
        status: 'conditional',
        explanationPlain: 'Cook County requires individualized assessment before denying for felonies.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'Cook County Just Housing Amendment',
      },
      {
        criteriaCode: 'CRIM_MISDEMEANOR',
        status: 'conditional',
        explanationPlain: 'Cook County requires individualized assessment for misdemeanor history.',
        requiredSteps: ['individualized_assessment'],
        statuteCitation: 'Cook County Just Housing Amendment',
      },
    ],
  },

  // ===== ARIZONA - Source of Income (City-level) =====
  {
    name: 'Phoenix',
    stateId: 'AZ',
    type: 'city',
    rules: [
      {
        criteriaCode: 'INCOME_VOUCHER',
        status: 'blocked',
        explanationPlain: 'Phoenix explicitly protects source of income including housing vouchers.',
        whyItMatters: 'You cannot reject an applicant solely because they use a housing voucher.',
        legalAlternative: 'Evaluate based on income amount and rental history, not income source.',
        statuteCitation: 'Phoenix City Code - Source of Income Protection',
      },
    ],
  },
  {
    name: 'Tucson',
    stateId: 'AZ',
    type: 'city',
    rules: [
      {
        criteriaCode: 'INCOME_VOUCHER',
        status: 'blocked',
        explanationPlain: 'Tucson Source of Income ordinance makes it unlawful to reject due to income source.',
        whyItMatters: 'Housing Choice Vouchers are explicitly protected.',
        legalAlternative: 'Evaluate based on income amount and rental history, not income source.',
        statuteCitation: 'Tucson Source of Income Ordinance',
      },
    ],
  },
  {
    name: 'Tempe',
    stateId: 'AZ',
    type: 'city',
    rules: [
      {
        criteriaCode: 'INCOME_VOUCHER',
        status: 'blocked',
        explanationPlain: 'Tempe code includes Source of Income protection including Housing Choice Vouchers.',
        whyItMatters: 'You cannot reject applicants for using vouchers.',
        legalAlternative: 'Evaluate based on income amount and rental history, not income source.',
        statuteCitation: 'Tempe City Code - SOI Protection',
      },
    ],
  },

  // ===== VIRGINIA - Statewide Source of Income =====
  {
    name: 'Virginia',
    stateId: 'VA',
    type: 'state',
    rules: [
      {
        criteriaCode: 'INCOME_VOUCHER',
        status: 'blocked',
        explanationPlain: 'Virginia fair housing law protects source of funds/income statewide.',
        whyItMatters: 'Voucher-based denial is generally not allowed in Virginia.',
        legalAlternative: 'Evaluate based on income amount and rental history, not income source.',
        statuteCitation: 'Virginia Fair Housing Law - Source of Funds Protection',
      },
    ],
  },
];

async function seedJurisdictionRules() {
  console.log('🏛️ Starting jurisdiction rules seed...\n');

  // Get all criteria for code lookups
  const allCriteria = await db.select().from(denialCriteria);
  const criteriaByCode = new Map(allCriteria.map(c => [c.code, c]));

  let citiesCreated = 0;
  let countiesCreated = 0;
  let stateRulesCreated = 0;
  let rulesCreated = 0;

  for (const jurisdiction of jurisdictionSeeds) {
    console.log(`Processing: ${jurisdiction.name}, ${jurisdiction.stateId} (${jurisdiction.type})`);

    let cityId: string | null = null;
    let countyId: string | null = null;
    let stateIdForRule: string | null = null;

    if (jurisdiction.type === 'city') {
      // Check if city already exists
      const existingCity = await db.select().from(cities)
        .where(and(
          eq(cities.name, jurisdiction.name),
          eq(cities.stateId, jurisdiction.stateId)
        ));

      if (existingCity.length > 0) {
        cityId = existingCity[0].id;
        console.log(`  City already exists: ${jurisdiction.name}`);
      } else {
        const [newCity] = await db.insert(cities).values({
          name: jurisdiction.name,
          stateId: jurisdiction.stateId,
          isActive: true,
        }).returning();
        cityId = newCity.id;
        citiesCreated++;
        console.log(`  Created city: ${jurisdiction.name}`);
      }
    } else if (jurisdiction.type === 'county') {
      // Check if county already exists
      const existingCounty = await db.select().from(counties)
        .where(and(
          eq(counties.name, jurisdiction.name),
          eq(counties.stateId, jurisdiction.stateId)
        ));

      if (existingCounty.length > 0) {
        countyId = existingCounty[0].id;
        console.log(`  County already exists: ${jurisdiction.name}`);
      } else {
        const [newCounty] = await db.insert(counties).values({
          name: jurisdiction.name,
          stateId: jurisdiction.stateId,
          isActive: true,
        }).returning();
        countyId = newCounty.id;
        countiesCreated++;
        console.log(`  Created county: ${jurisdiction.name}`);
      }
    } else if (jurisdiction.type === 'state') {
      // State-level rules - just use the stateId
      stateIdForRule = jurisdiction.stateId;
      stateRulesCreated++;
    }

    // Create rules for this jurisdiction
    for (const rule of jurisdiction.rules) {
      const criteria = criteriaByCode.get(rule.criteriaCode);
      if (!criteria) {
        console.warn(`  ⚠️ Criteria code not found: ${rule.criteriaCode}`);
        continue;
      }

      // Check if rule already exists for this jurisdiction + criteria
      const existingRule = await db.select().from(denialCriteriaRules)
        .where(and(
          eq(denialCriteriaRules.criteriaId, criteria.id),
          cityId ? eq(denialCriteriaRules.cityId, cityId) : isNull(denialCriteriaRules.cityId),
          countyId ? eq(denialCriteriaRules.countyId, countyId) : isNull(denialCriteriaRules.countyId),
          jurisdiction.type === 'state' 
            ? and(eq(denialCriteriaRules.stateId, stateIdForRule!), isNull(denialCriteriaRules.cityId), isNull(denialCriteriaRules.countyId))
            : undefined
        ));

      if (existingRule.length > 0) {
        console.log(`    Rule exists for ${rule.criteriaCode} - skipping`);
        continue;
      }

      await db.insert(denialCriteriaRules).values({
        criteriaId: criteria.id,
        stateId: jurisdiction.stateId,
        cityId: cityId,
        countyId: countyId,
        status: rule.status,
        explanationPlain: rule.explanationPlain,
        whyItMatters: rule.whyItMatters || null,
        legalAlternative: rule.legalAlternative || null,
        requiredSteps: rule.requiredSteps || null,
        statuteCitation: rule.statuteCitation || null,
        version: 1,
      });
      rulesCreated++;
      console.log(`    Created rule: ${rule.criteriaCode} = ${rule.status}`);
    }
  }

  console.log('\n✅ Seed complete!');
  console.log(`   Cities created: ${citiesCreated}`);
  console.log(`   Counties created: ${countiesCreated}`);
  console.log(`   State-level rule sets: ${stateRulesCreated}`);
  console.log(`   Total rules created: ${rulesCreated}`);
}

// Run the seed
seedJurisdictionRules()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
