// Scheduled jobs for LeaseShield App
// In production, this would use a proper job queue like Bull, Agenda, or node-cron

import { storage } from "./storage";
import { emailService } from "./emailService";
import { db } from "./db";
import { users } from "@shared/schema";
import { and, eq, lt, gte, sql } from "drizzle-orm";

export class ScheduledJobs {
  private trialReminderInterval: NodeJS.Timeout | null = null;

  // Check for trials ending soon and send reminder emails
  async checkTrialReminders(): Promise<void> {
    try {
      console.log('🔔 Checking for trial reminders...');

      // Find users who:
      // 1. Are currently in trial
      // 2. Have trial ending in the next 24-48 hours (day 6 of trial)
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const dayAfterTomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const trialingUsers = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.subscriptionStatus, 'trialing'),
            gte(users.trialEndsAt, tomorrow),
            lt(users.trialEndsAt, dayAfterTomorrow)
          )
        );

      console.log(`  Found ${trialingUsers.length} users with trials ending soon`);

      for (const user of trialingUsers) {
        if (user.email && user.trialEndsAt) {
          // Check if we've already sent a reminder to this user
          const existingReminder = await storage.getUserTrialReminderEvent(user.id);
          
          if (existingReminder) {
            console.log(`  Skipping ${user.email} - reminder already sent`);
            continue;
          }

          console.log(`  Sending trial reminder to ${user.email}...`);
          
          await emailService.sendTrialReminderEmail(
            {
              email: user.email,
              firstName: user.firstName || undefined,
              lastName: user.lastName || undefined,
            },
            user.trialEndsAt
          );

          // Track the reminder email in analytics (prevents duplicate sends)
          await storage.trackEvent({
            userId: user.id,
            eventType: 'trial_reminder_sent',
            eventData: { trialEndsAt: user.trialEndsAt },
          });
        }
      }

      console.log('✅ Trial reminder check complete');
    } catch (error) {
      console.error('❌ Error checking trial reminders:', error);
    }
  }

  // Send welcome/confirmation email when subscription becomes active
  async sendSubscriptionConfirmations(): Promise<void> {
    try {
      console.log('🔔 Checking for new subscriptions to confirm...');

      // In a real implementation, we'd track which users have received confirmation emails
      // For MVP, we'll just log this functionality
      console.log('✅ Subscription confirmation check complete (placeholder)');
    } catch (error) {
      console.error('❌ Error sending subscription confirmations:', error);
    }
  }

  // Notify users when new legal updates are published for their state
  async notifyLegalUpdates(): Promise<void> {
    try {
      console.log('🔔 Checking for legal updates to notify...');

      // Get legal updates created in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentUpdates = await db.query.legalUpdates.findMany({
        where: (updates, { gte }) => gte(updates.createdAt, oneDayAgo),
      });

      if (recentUpdates.length === 0) {
        console.log('  No recent legal updates to notify about');
        return;
      }

      console.log(`  Found ${recentUpdates.length} recent legal updates`);

      for (const update of recentUpdates) {
        // Find all users with this preferred state
        const affectedUsers = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.preferredState, update.stateId),
              eq(users.subscriptionStatus, 'active')
            )
          );

        console.log(`  Notifying ${affectedUsers.length} users about ${update.title}`);

        for (const user of affectedUsers) {
          if (user.email) {
            // Send email notification
            await emailService.sendLegalUpdateEmail(
              {
                email: user.email,
                firstName: user.firstName || undefined,
                lastName: user.lastName || undefined,
              },
              update.title,
              update.summary,
              update.stateId,
              update.impactLevel
            );

            // Create in-app notification
            await storage.createUserNotification({
              userId: user.id,
              legalUpdateId: update.id,
              message: `New ${update.impactLevel} impact legal update: ${update.title}`,
              isRead: false,
            });

            // Track the notification in analytics
            await storage.trackEvent({
              userId: user.id,
              eventType: 'legal_update_notified',
              eventData: { updateId: update.id, impactLevel: update.impactLevel },
            });
          }
        }
      }

      console.log('✅ Legal update notifications complete');
    } catch (error) {
      console.error('❌ Error notifying legal updates:', error);
    }
  }

  // Start all scheduled jobs
  start(): void {
    console.log('🚀 Starting scheduled jobs...');

    // Check for trial reminders every 6 hours
    // In production, this would run once daily at a specific time
    this.trialReminderInterval = setInterval(
      () => this.checkTrialReminders(),
      6 * 60 * 60 * 1000 // 6 hours
    );

    // Run initial check after 1 minute
    setTimeout(() => this.checkTrialReminders(), 60 * 1000);

    console.log('✅ Scheduled jobs started');
  }

  // Stop all scheduled jobs (for graceful shutdown)
  stop(): void {
    console.log('🛑 Stopping scheduled jobs...');
    
    if (this.trialReminderInterval) {
      clearInterval(this.trialReminderInterval);
      this.trialReminderInterval = null;
    }

    console.log('✅ Scheduled jobs stopped');
  }
}

export const scheduledJobs = new ScheduledJobs();
