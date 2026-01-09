/**
 * Monthly Publish Service
 * 
 * Runs on the 1st of each month at 2:15am.
 * Creates a release batch, queues template reviews based on new updates,
 * and notifies admins. Documents are only rebuilt after approval.
 */

import { db } from "../db";
import { 
  releaseBatches, 
  normalizedUpdates,
  templateTopicRouting,
  templateReviewQueue,
  templates,
  users,
  type InsertReleaseBatch,
} from "../../shared/schema";
import { eq, and, inArray, isNull, gte, sql } from "drizzle-orm";
import { emailService } from "../emailService";
import crypto from "crypto";

export interface PublishRunResult {
  batchId: string;
  period: string;
  status: 'success' | 'pending_review' | 'no_changes' | 'failed';
  updatesProcessed: number;
  templatesQueued: number;
  errors: string[];
}

interface TopicTemplateMapping {
  topic: string;
  templateIds: string[];
  jurisdictionState?: string;
}

async function getNewUpdatesSinceLastBatch(): Promise<typeof normalizedUpdates.$inferSelect[]> {
  const lastBatch = await db.select({ publishedAt: releaseBatches.publishedAt })
    .from(releaseBatches)
    .where(eq(releaseBatches.status, 'published'))
    .orderBy(sql`${releaseBatches.publishedAt} DESC`)
    .limit(1);
  
  const cutoffDate = lastBatch[0]?.publishedAt || new Date(0);
  
  return db.select()
    .from(normalizedUpdates)
    .where(and(
      eq(normalizedUpdates.isProcessed, false),
      eq(normalizedUpdates.isDuplicate, false),
      gte(normalizedUpdates.createdAt, cutoffDate)
    ));
}

async function getAffectedTemplates(
  topics: string[], 
  jurisdictionState?: string,
  jurisdictionLevel?: string
): Promise<string[]> {
  const routings = await db.select({ 
    templateId: templateTopicRouting.templateId, 
    topic: templateTopicRouting.topic,
    jurisdictionLevel: templateTopicRouting.jurisdictionLevel,
    jurisdictionState: templateTopicRouting.jurisdictionState,
  })
    .from(templateTopicRouting)
    .innerJoin(templates, eq(templateTopicRouting.templateId, templates.id))
    .where(eq(templateTopicRouting.isActive, true));
  
  const matchingTemplateIds = routings
    .filter(r => {
      if (!topics.includes(r.topic)) return false;
      
      if (r.jurisdictionLevel === 'tribal' && jurisdictionLevel !== 'tribal') {
        return false;
      }
      if (jurisdictionLevel === 'tribal' && r.jurisdictionLevel !== 'tribal' && r.jurisdictionLevel !== 'federal') {
        return false;
      }
      
      if (r.jurisdictionState && jurisdictionState && r.jurisdictionState !== jurisdictionState) {
        return false;
      }
      
      return true;
    })
    .map(r => r.templateId);
  
  return Array.from(new Set(matchingTemplateIds));
}

async function queueTemplateForReview(
  templateId: string,
  updateId: string,
  reason: string,
  jurisdiction?: string
): Promise<boolean> {
  const existing = await db.select({ id: templateReviewQueue.id })
    .from(templateReviewQueue)
    .where(and(
      eq(templateReviewQueue.templateId, templateId),
      eq(templateReviewQueue.normalizedUpdateId, updateId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return false;
  }
  
  await db.insert(templateReviewQueue).values({
    templateId,
    normalizedUpdateId: updateId,
    reason,
    jurisdiction,
    status: 'pending',
    queuedAt: new Date(),
  } as any);
  
  return true;
}

async function notifyAdmins(batchId: string, result: PublishRunResult): Promise<void> {
  const adminUsers = await db.select({ 
    email: users.email, 
    firstName: users.firstName,
    lastName: users.lastName 
  })
    .from(users)
    .where(eq(users.isAdmin, true));
  
  if (adminUsers.length === 0) {
    console.log('   No admin users to notify');
    return;
  }
  
  for (const admin of adminUsers) {
    try {
      const sent = await emailService.sendLegalUpdateEmail(
        { 
          email: admin.email, 
          firstName: admin.firstName || undefined,
        },
        `${result.period} Legislative Updates - ${result.templatesQueued} Templates Queued`,
        `Monthly batch processing complete. ${result.updatesProcessed} updates processed, ${result.templatesQueued} templates queued for review. ${result.templatesQueued > 0 ? 'Please review and approve queued templates in admin panel.' : ''}`,
        'ALL',
        result.templatesQueued > 0 ? 'high' : 'low'
      );
      if (sent) {
        console.log(`   📧 Notified admin: ${admin.email}`);
      }
    } catch (error) {
      console.error(`   Failed to notify ${admin.email}: ${error}`);
    }
  }
}

export async function runMonthlyPublish(batchType: 'monthly' | 'manual' = 'monthly'): Promise<PublishRunResult> {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const errors: string[] = [];
  
  console.log(`\n📦 Starting Monthly Publish (Period: ${period})`);
  console.log(`   Time: ${now.toISOString()}\n`);
  
  const existingBatch = await db.select({ id: releaseBatches.id, status: releaseBatches.status })
    .from(releaseBatches)
    .where(and(
      eq(releaseBatches.period, period),
      eq(releaseBatches.batchType, batchType)
    ))
    .limit(1);
  
  if (existingBatch.length > 0 && existingBatch[0].status === 'running') {
    console.log('⚠️ A batch is already running for this period. Aborting.');
    return {
      batchId: existingBatch[0].id,
      period,
      status: 'failed',
      updatesProcessed: 0,
      templatesQueued: 0,
      errors: ['Batch already running for this period'],
    };
  }
  
  const batchInsert: InsertReleaseBatch = {
    batchType,
    period,
    status: 'running',
  };
  
  const [batch] = await db.insert(releaseBatches).values(batchInsert).returning({ id: releaseBatches.id });
  const batchId = batch.id;
  
  console.log(`   Created batch: ${batchId}`);
  
  try {
    const newUpdates = await getNewUpdatesSinceLastBatch();
    
    if (newUpdates.length === 0) {
      console.log('   No new updates since last batch. Marking complete.');
      
      await db.update(releaseBatches)
        .set({
          status: 'published',
          publishedAt: new Date(),
          updatesProcessed: 0,
          templatesQueued: 0,
          summaryReport: 'No new legislative updates found.',
        })
        .where(eq(releaseBatches.id, batchId));
      
      return {
        batchId,
        period,
        status: 'no_changes',
        updatesProcessed: 0,
        templatesQueued: 0,
        errors: [],
      };
    }
    
    console.log(`   Found ${newUpdates.length} new updates to process`);
    
    let templatesQueued = 0;
    const processedUpdateIds: string[] = [];
    
    for (const update of newUpdates) {
      try {
        const affectedTemplates = await getAffectedTemplates(
          update.topics,
          update.jurisdictionState || undefined,
          update.jurisdictionLevel || undefined
        );
        
        console.log(`   Update "${update.title.substring(0, 50)}..." affects ${affectedTemplates.length} templates`);
        
        for (const templateId of affectedTemplates) {
          const reason = `Legislative update: ${update.title.substring(0, 100)}${update.title.length > 100 ? '...' : ''}`;
          const queued = await queueTemplateForReview(
            templateId,
            update.id,
            reason,
            update.jurisdictionState || undefined
          );
          
          if (queued) {
            templatesQueued++;
          }
        }
        
        await db.update(normalizedUpdates)
          .set({
            isProcessed: true,
            processedAt: new Date(),
            isQueued: affectedTemplates.length > 0,
            queuedAt: affectedTemplates.length > 0 ? new Date() : undefined,
            updatedAt: new Date(),
          })
          .where(eq(normalizedUpdates.id, update.id));
        
        processedUpdateIds.push(update.id);
        
      } catch (error) {
        const err = `Failed to process update ${update.id}: ${error}`;
        console.error(`   ❌ ${err}`);
        errors.push(err);
      }
    }
    
    const finalStatus = templatesQueued > 0 ? 'pending_review' : 'published';
    
    await db.update(releaseBatches)
      .set({
        status: finalStatus,
        publishedAt: finalStatus === 'published' ? new Date() : undefined,
        updatesProcessed: processedUpdateIds.length,
        templatesQueued,
        summaryReport: `Processed ${processedUpdateIds.length} updates, queued ${templatesQueued} templates for review.`,
        errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
      })
      .where(eq(releaseBatches.id, batchId));
    
    const result: PublishRunResult = {
      batchId,
      period,
      status: templatesQueued > 0 ? 'pending_review' : 'success',
      updatesProcessed: processedUpdateIds.length,
      templatesQueued,
      errors,
    };
    
    if (templatesQueued > 0) {
      await notifyAdmins(batchId, result);
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Monthly Publish Complete`);
    console.log(`   Batch ID: ${batchId}`);
    console.log(`   Period: ${period}`);
    console.log(`   Updates processed: ${processedUpdateIds.length}`);
    console.log(`   Templates queued: ${templatesQueued}`);
    console.log(`   Status: ${result.status}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return result;
    
  } catch (error) {
    console.error(`\n❌ Monthly publish failed: ${error}`);
    errors.push(`Publish error: ${error}`);
    
    await db.update(releaseBatches)
      .set({
        status: 'failed',
        errorMessage: String(error),
      })
      .where(eq(releaseBatches.id, batchId));
    
    return {
      batchId,
      period,
      status: 'failed',
      updatesProcessed: 0,
      templatesQueued: 0,
      errors,
    };
  }
}
