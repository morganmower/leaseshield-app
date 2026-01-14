/**
 * Topic-to-Template Mapping Configuration
 * 
 * Defines which legislative topics affect which templates.
 * This enables topic-based routing so tribal updates only affect tribal templates.
 */

import { db } from "../db";
import { templateTopicRouting, templates, type InsertTemplateTopicRouting } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface TopicMappingRule {
  topic: string;
  templateCategories?: string[];
  templateNamePatterns?: RegExp[];
  jurisdictionLevel?: 'federal' | 'state' | 'tribal' | 'local';
  jurisdictionStates?: string[];
  description: string;
}

export const TOPIC_MAPPING_RULES: TopicMappingRule[] = [
  {
    topic: 'nahasda_core',
    templateCategories: ['tribal', 'nahasda'],
    templateNamePatterns: [/tribal/i, /nahasda/i, /indian housing/i, /ihbg/i],
    jurisdictionLevel: 'tribal',
    description: 'NAHASDA core requirements - tribal housing templates only',
  },
  {
    topic: 'ihbg',
    templateCategories: ['tribal', 'nahasda'],
    templateNamePatterns: [/ihbg/i, /indian housing block grant/i, /tribal/i],
    jurisdictionLevel: 'tribal',
    description: 'Indian Housing Block Grant - tribal funding templates',
  },
  {
    topic: 'tribal_adjacent',
    templateCategories: ['tribal'],
    templateNamePatterns: [/tribal/i, /native/i, /indian/i],
    jurisdictionLevel: 'tribal',
    description: 'Tribal-adjacent updates - general tribal templates',
  },
  {
    topic: 'landlord_tenant',
    templateCategories: ['lease', 'rental', 'landlord', 'tenant', 'notice', 'eviction'],
    templateNamePatterns: [/lease/i, /rental/i, /landlord/i, /tenant/i, /notice/i, /eviction/i],
    jurisdictionLevel: 'state',
    description: 'Landlord-tenant law - state-specific lease templates',
  },
  {
    topic: 'fair_housing',
    templateCategories: ['lease', 'rental', 'compliance', 'screening'],
    templateNamePatterns: [/fair housing/i, /discrimination/i, /screening/i, /application/i],
    description: 'Fair Housing Act - affects screening and lease templates',
  },
  {
    topic: 'security_deposit',
    templateCategories: ['lease', 'move-in', 'move-out'],
    templateNamePatterns: [/security deposit/i, /deposit/i, /move.?in/i, /move.?out/i],
    jurisdictionLevel: 'state',
    description: 'Security deposit laws - state-specific deposit templates',
  },
  {
    topic: 'eviction',
    templateCategories: ['eviction', 'notice', 'court'],
    templateNamePatterns: [/eviction/i, /notice to quit/i, /unlawful detainer/i, /pay or quit/i],
    jurisdictionLevel: 'state',
    description: 'Eviction procedures - state-specific eviction templates',
  },
  {
    topic: 'hud_general',
    templateCategories: ['compliance', 'federal', 'hud'],
    templateNamePatterns: [/hud/i, /federal/i, /section 8/i, /voucher/i],
    jurisdictionLevel: 'federal',
    description: 'HUD general regulations - federal compliance templates',
  },
  {
    topic: 'environmental',
    templateCategories: ['environmental', 'disclosure', 'tribal'],
    templateNamePatterns: [/environmental/i, /lead/i, /asbestos/i, /mold/i, /radon/i],
    description: 'Environmental requirements - disclosure templates',
  },
  {
    topic: 'income_limits',
    templateCategories: ['affordable', 'income', 'tribal'],
    templateNamePatterns: [/income/i, /affordable/i, /low.?income/i],
    description: 'Income limit updates - affordable housing templates',
  },
  {
    topic: 'procurement',
    templateCategories: ['tribal', 'procurement', 'contractor'],
    templateNamePatterns: [/procurement/i, /contractor/i, /bid/i],
    jurisdictionLevel: 'tribal',
    description: 'Procurement rules - tribal contractor templates',
  },
];

export async function getTemplatesForTopic(topic: string, jurisdictionState?: string): Promise<string[]> {
  const routings = await db.select({ templateId: templateTopicRouting.templateId })
    .from(templateTopicRouting)
    .where(and(
      eq(templateTopicRouting.topic, topic as any),
      eq(templateTopicRouting.isActive, true)
    ));
  
  return routings.map(r => r.templateId);
}

export async function getTemplatesForTopics(topics: string[], jurisdictionState?: string): Promise<string[]> {
  const allTemplateIds: string[] = [];
  
  for (const topic of topics) {
    const templateIds = await getTemplatesForTopic(topic, jurisdictionState);
    allTemplateIds.push(...templateIds);
  }
  
  return Array.from(new Set(allTemplateIds));
}

export async function seedTopicRoutings(): Promise<number> {
  console.log('🔧 Seeding topic-to-template routing configuration...');
  
  const existingCount = await db.select({ count: sql<number>`count(*)` })
    .from(templateTopicRouting);
  
  if (existingCount[0].count > 0) {
    console.log(`   Already have ${existingCount[0].count} routing rules, skipping seed`);
    return 0;
  }
  
  const allTemplates = await db.select({ id: templates.id, title: templates.title, category: templates.category })
    .from(templates);
  
  let routingsCreated = 0;
  
  for (const rule of TOPIC_MAPPING_RULES) {
    for (const template of allTemplates) {
      let matches = false;
      
      if (rule.templateCategories && rule.templateCategories.some(cat => 
        template.category?.toLowerCase().includes(cat.toLowerCase())
      )) {
        matches = true;
      }
      
      if (!matches && rule.templateNamePatterns) {
        matches = rule.templateNamePatterns.some(pattern => pattern.test(template.title));
      }
      
      if (matches) {
        try {
          await db.insert(templateTopicRouting).values({
            templateId: template.id,
            topic: rule.topic as any,
            jurisdictionLevel: rule.jurisdictionLevel,
            isActive: true,
          });
          routingsCreated++;
        } catch (error) {
        }
      }
    }
  }
  
  console.log(`✅ Created ${routingsCreated} topic routing rules`);
  return routingsCreated;
}

export async function addTopicRouting(
  templateId: string,
  topic: string,
  jurisdictionLevel?: 'federal' | 'state' | 'tribal' | 'local',
  jurisdictionState?: string
): Promise<void> {
  await db.insert(templateTopicRouting).values({
    templateId,
    topic: topic as any,
    jurisdictionLevel,
    jurisdictionState,
    isActive: true,
  });
}

export async function removeTopicRouting(routingId: string): Promise<void> {
  await db.update(templateTopicRouting)
    .set({ isActive: false })
    .where(eq(templateTopicRouting.id, routingId));
}
