import OpenAI from 'openai';
import { db } from '../db';
import { legalUpdates } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Use Replit AI integration (has quota and doesn't require personal API key)
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
const targetId = process.argv[2] || '1f8db505-6653-45b9-bbd4-516ed2aedec1';

async function main() {
  const [update] = await db.select().from(legalUpdates).where(eq(legalUpdates.id, targetId));
  if (!update) {
    console.log('Update not found:', targetId);
    return;
  }
  
  console.log('Enriching:', update.title, 'in', update.stateId);
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: 'You are a legal analyst helping landlords understand legislation. Generate helpful, specific content.'
    }, {
      role: 'user',
      content: `Analyze this legislative update for landlords in ${update.stateId}:
Title: ${update.title}
Category: ${update.category || 'legislation'}
Impact: ${update.impactLevel || 'medium'}

Generate a JSON response with these fields:
- summary: 2-3 sentence plain English summary of what this legislation covers
- whyItMatters: Why landlords should care (specific financial/legal impact)
- beforeText: What the law was before (if unknown, provide general context)
- afterText: What current law requires
- billStatus: One of: pending, passed, signed, enacted, effective
- actionItems: Array of 2-3 specific actions landlords should take
- expectedTimeline: When landlords need to comply

Respond ONLY with valid JSON.`
    }],
    response_format: { type: 'json_object' }
  });
  
  const content = response.choices[0].message.content;
  console.log('AI Response:', content);
  const parsed = JSON.parse(content || '{}');
  
  let actionItems = parsed.actionItems || '';
  if (Array.isArray(actionItems)) {
    actionItems = actionItems.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n');
  }
  
  await db.update(legalUpdates)
    .set({
      summary: parsed.summary,
      whyItMatters: parsed.whyItMatters,
      beforeText: parsed.beforeText,
      afterText: parsed.afterText,
      billStatus: parsed.billStatus || 'enacted',
      actionItems: actionItems,
      expectedTimeline: parsed.expectedTimeline || '',
      aiEnriched: true
    })
    .where(eq(legalUpdates.id, targetId));
  
  console.log('✅ Done!');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
