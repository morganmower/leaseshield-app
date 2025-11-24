// Scheduled jobs for LeaseShield App
// In production, this would use a proper job queue like Bull, Agenda, or node-cron

import { storage } from "./storage";
import { emailService } from "./emailService";
import { db } from "./db";
import { users } from "@shared/schema";
import { and, eq, lt, gte, sql } from "drizzle-orm";
import { runMonthlyLegislativeMonitoring } from "./legislativeMonitoring";

export class ScheduledJobs {
  private trialReminderInterval: NodeJS.Timeout | null = null;
  private trialExpiryInterval: NodeJS.Timeout | null = null;
  private legislativeMonitoringInterval: NodeJS.Timeout | null = null;
  private legislativeMonitoringLastRun: Date | null = null;

  // Check for trials ending soon and send reminder emails (2 days before)
  async checkTrialReminders(): Promise<void> {
    try {
      console.log('🔔 Checking for trial reminders...');

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

  // Check for expired trials and send expiration emails
  async checkTrialExpiry(): Promise<void> {
    try {
      console.log('⏳ Checking for expired trials...');

      const now = new Date();
      
      // Find users whose trials have just expired (in the last 24 hours)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const expiredUsers = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.subscriptionStatus, 'trialing'),
            lt(users.trialEndsAt, now),
            gte(users.trialEndsAt, oneDayAgo)
          )
        );

      console.log(`  Found ${expiredUsers.length} users with expired trials`);

      for (const user of expiredUsers) {
        if (user.email) {
          const existingExpiredEmail = await storage.getUserTrialExpiredEvent(user.id);
          
          if (existingExpiredEmail) {
            console.log(`  Skipping ${user.email} - expiration email already sent`);
            continue;
          }

          console.log(`  Sending trial expired email to ${user.email}...`);
          
          await emailService.sendTrialExpiredEmail(
            {
              email: user.email,
              firstName: user.firstName || undefined,
              lastName: user.lastName || undefined,
            }
          );

          await storage.trackEvent({
            userId: user.id,
            eventType: 'trial_expired_email_sent',
            eventData: { trialEndsAt: user.trialEndsAt },
          });
        }
      }

      console.log('✅ Trial expiry check complete');
    } catch (error) {
      console.error('❌ Error checking trial expiry:', error);
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

  // Check if legislative monitoring should run (monthly on the 1st)
  async checkLegislativeMonitoring(): Promise<void> {
    try {
      const now = new Date();
      const dayOfMonth = now.getDate();

      // Only run on the 1st of the month
      if (dayOfMonth !== 1) {
        return;
      }

      // Check if we've already run this month
      if (this.legislativeMonitoringLastRun) {
        const lastRunMonth = this.legislativeMonitoringLastRun.getMonth();
        const currentMonth = now.getMonth();
        
        if (lastRunMonth === currentMonth) {
          console.log('  Legislative monitoring already ran this month');
          return;
        }
      }

      console.log('🔍 Running monthly legislative monitoring...');
      await runMonthlyLegislativeMonitoring();
      this.legislativeMonitoringLastRun = now;
      
    } catch (error) {
      console.error('❌ Error in legislative monitoring check:', error);
    }
  }

  // Start all scheduled jobs
  start(): void {
    console.log('🚀 Starting scheduled jobs...');

    // Check for trial reminders every 6 hours
    this.trialReminderInterval = setInterval(
      () => this.checkTrialReminders(),
      6 * 60 * 60 * 1000
    );
    setTimeout(() => this.checkTrialReminders(), 60 * 1000);

    // Check for trial expiry every 6 hours
    this.trialExpiryInterval = setInterval(
      () => this.checkTrialExpiry(),
      6 * 60 * 60 * 1000
    );
    setTimeout(() => this.checkTrialExpiry(), 90 * 1000);

    // Check for legislative monitoring daily
    this.legislativeMonitoringInterval = setInterval(
      () => this.checkLegislativeMonitoring(),
      24 * 60 * 60 * 1000
    );
    setTimeout(() => this.checkLegislativeMonitoring(), 2 * 60 * 1000);

    console.log('✅ Scheduled jobs started');
  }

  // Stop all scheduled jobs
  stop(): void {
    console.log('🛑 Stopping scheduled jobs...');
    
    if (this.trialReminderInterval) {
      clearInterval(this.trialReminderInterval);
      this.trialReminderInterval = null;
    }

    if (this.trialExpiryInterval) {
      clearInterval(this.trialExpiryInterval);
      this.trialExpiryInterval = null;
    }

    if (this.legislativeMonitoringInterval) {
      clearInterval(this.legislativeMonitoringInterval);
      this.legislativeMonitoringInterval = null;
    }

    console.log('✅ Scheduled jobs stopped');
  }
}

export const scheduledJobs = new ScheduledJobs();
