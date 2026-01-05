// Scheduled jobs for LeaseShield App
// In production, this would use a proper job queue like Bull, Agenda, or node-cron

import { storage } from "./storage";
import { emailService } from "./emailService";
import { db } from "./db";
import { users } from "@shared/schema";
import { and, eq, lt, gte, sql } from "drizzle-orm";
import { runMonthlyLegislativeMonitoring } from "./legislativeMonitoring";
import { setupEmailSequences } from "./emailSequenceSetup";
import { runUploadCleanup } from "./cleanup";

export class ScheduledJobs {
  private trialReminderInterval: NodeJS.Timeout | null = null;
  private trialExpiryInterval: NodeJS.Timeout | null = null;
  private trialExpirationEnrollmentInterval: NodeJS.Timeout | null = null;
  private legislativeMonitoringInterval: NodeJS.Timeout | null = null;
  private emailSequenceInterval: NodeJS.Timeout | null = null;
  private renewalReminderInterval: NodeJS.Timeout | null = null;
  private uploadCleanupInterval: NodeJS.Timeout | null = null;
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
        // Find all users with this preferred state who have opted in to legal update notifications
        const affectedUsers = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.preferredState, update.stateId),
              eq(users.subscriptionStatus, 'active'),
              eq(users.notifyLegalUpdates, true) // Respect user's notification preference
            )
          );

        console.log(`  Notifying ${affectedUsers.length} opted-in users about ${update.title}`);

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

  // Enroll users in trial expiration sequence 3 days before expiry
  async checkTrialExpirationEnrollments(): Promise<void> {
    try {
      console.log('🔔 Checking for trial expiration enrollments...');

      const now = new Date();
      // Find users whose trial ends in 3 days (between 72-78 hours from now)
      const threeDaysFromNow = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      const threeDaysAndSixHours = new Date(now.getTime() + 78 * 60 * 60 * 1000);

      const expiringUsers = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.subscriptionStatus, 'trialing'),
            gte(users.trialEndsAt, threeDaysFromNow),
            lt(users.trialEndsAt, threeDaysAndSixHours)
          )
        );

      console.log(`  Found ${expiringUsers.length} users with trials expiring in ~3 days`);

      if (expiringUsers.length === 0) return;

      // Get the trial expiration sequence
      const trialSequence = await storage.getEmailSequenceByTrigger('trial_expiring');
      if (!trialSequence || !trialSequence.isActive) {
        console.log('  Trial expiration sequence not found or inactive');
        return;
      }

      const steps = await storage.getEmailSequenceSteps(trialSequence.id);
      const firstStep = steps[0];

      for (const user of expiringUsers) {
        // Check if user is already enrolled in this sequence
        const existingEnrollment = await storage.getActiveEnrollmentByUserAndSequence(user.id, trialSequence.id);
        if (existingEnrollment) {
          console.log(`  Skipping ${user.email} - already enrolled in trial expiration sequence`);
          continue;
        }

        // Enroll user in trial expiration sequence
        const nextSendAt = firstStep
          ? new Date(Date.now() + firstStep.delayHours * 60 * 60 * 1000)
          : null;

        await storage.createEnrollment({
          userId: user.id,
          sequenceId: trialSequence.id,
          currentStep: 0,
          status: 'active',
          nextSendAt,
        });

        console.log(`  ✓ Enrolled ${user.email} in trial expiration sequence`);
      }

      console.log('✅ Trial expiration enrollment check complete');
    } catch (error) {
      console.error('❌ Error checking trial expiration enrollments:', error);
    }
  }

  // Process pending email sequence steps
  async processEmailSequences(): Promise<void> {
    try {
      console.log('📧 Processing email sequences...');

      const pendingEnrollments = await storage.getPendingEnrollments();
      console.log(`  Found ${pendingEnrollments.length} enrollments ready to process`);

      for (const enrollment of pendingEnrollments) {
        try {
          const sequence = await storage.getEmailSequenceById(enrollment.sequenceId);
          if (!sequence || !sequence.isActive) {
            console.log(`  Skipping enrollment ${enrollment.id} - sequence inactive`);
            continue;
          }

          const steps = await storage.getEmailSequenceSteps(enrollment.sequenceId);
          const nextStepIndex = enrollment.currentStep;
          
          if (nextStepIndex >= steps.length) {
            await storage.updateEnrollment(enrollment.id, {
              status: 'completed',
              completedAt: new Date(),
            });
            console.log(`  ✓ Completed sequence for enrollment ${enrollment.id}`);
            continue;
          }

          const step = steps[nextStepIndex];
          if (!step || !step.isActive) {
            continue;
          }

          const user = await storage.getUser(enrollment.userId);
          if (!user || !user.email) {
            console.log(`  Skipping enrollment ${enrollment.id} - user has no email`);
            continue;
          }

          const result = await emailService.sendAIEmail(user, step, enrollment.sequenceId);
          
          if (result.success) {
            const nextStep = nextStepIndex + 1;
            const isComplete = nextStep >= steps.length;
            
            let nextSendAt: Date | null = null;
            if (!isComplete && steps[nextStep]) {
              nextSendAt = new Date(Date.now() + steps[nextStep].delayHours * 60 * 60 * 1000);
            }

            await storage.updateEnrollment(enrollment.id, {
              currentStep: nextStep,
              status: isComplete ? 'completed' : 'active',
              nextSendAt,
              lastSentAt: new Date(),
              completedAt: isComplete ? new Date() : undefined,
            });

            console.log(`  ✓ Sent step ${step.stepNumber} to ${user.email}`);
          } else {
            console.log(`  ⚠ Failed to send step ${step.stepNumber} to ${user.email}`);
          }
        } catch (enrollmentError) {
          console.error(`  ❌ Error processing enrollment ${enrollment.id}:`, enrollmentError);
        }
      }

      console.log('✅ Email sequence processing complete');
    } catch (error) {
      console.error('❌ Error processing email sequences:', error);
    }
  }

  // Check for yearly subscriptions nearing renewal and send reminder emails
  async checkRenewalReminders(): Promise<void> {
    try {
      console.log('🔄 Checking for subscription renewal reminders...');

      const usersNeedingReminder = await storage.getUsersNeedingRenewalReminder();
      
      console.log(`  Found ${usersNeedingReminder.length} yearly subscribers needing renewal reminder`);

      for (const user of usersNeedingReminder) {
        if (user.email && user.subscriptionEndsAt) {
          console.log(`  Sending renewal reminder to ${user.email}...`);
          
          const success = await emailService.sendRenewalReminderEmail(
            {
              email: user.email,
              firstName: user.firstName || undefined,
              lastName: user.lastName || undefined,
            },
            user.subscriptionEndsAt,
            100 // $100/year
          );

          if (success) {
            // Update the renewal reminder sent timestamp
            await storage.updateUserStripeInfo(user.id, {
              renewalReminderSentAt: new Date(),
            });
            console.log(`  ✅ Renewal reminder sent to ${user.email}`);
          }
        }
      }

      console.log('✅ Renewal reminder check complete');
    } catch (error) {
      console.error('❌ Error checking renewal reminders:', error);
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

      // Check database if we've already run this month (persisted across restarts)
      const hasRunThisMonth = await storage.hasMonitoringRunThisMonth();
      if (hasRunThisMonth) {
        console.log('  Legislative monitoring already ran this month (from database)');
        return;
      }

      console.log('🔍 Running monthly legislative monitoring...');
      await runMonthlyLegislativeMonitoring();
      
    } catch (error) {
      console.error('❌ Error in legislative monitoring check:', error);
    }
  }

  // Start all scheduled jobs
  async start(): Promise<void> {
    console.log('🚀 Starting scheduled jobs...');

    // Set up email sequences on startup
    await setupEmailSequences();

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

    // Check for trial expiration enrollments every 6 hours
    this.trialExpirationEnrollmentInterval = setInterval(
      () => this.checkTrialExpirationEnrollments(),
      6 * 60 * 60 * 1000
    );
    setTimeout(() => this.checkTrialExpirationEnrollments(), 2 * 60 * 1000);

    // Check for legislative monitoring daily
    this.legislativeMonitoringInterval = setInterval(
      () => this.checkLegislativeMonitoring(),
      24 * 60 * 60 * 1000
    );
    setTimeout(() => this.checkLegislativeMonitoring(), 2 * 60 * 1000);

    // Process email sequences every hour
    this.emailSequenceInterval = setInterval(
      () => this.processEmailSequences(),
      60 * 60 * 1000
    );
    setTimeout(() => this.processEmailSequences(), 3 * 60 * 1000);

    // Check for renewal reminders every 12 hours
    this.renewalReminderInterval = setInterval(
      () => this.checkRenewalReminders(),
      12 * 60 * 60 * 1000
    );
    setTimeout(() => this.checkRenewalReminders(), 4 * 60 * 1000);

    // Run upload cleanup daily
    this.uploadCleanupInterval = setInterval(
      () => runUploadCleanup().catch(e => console.error('[CLEANUP] interval error:', e)),
      24 * 60 * 60 * 1000
    );
    setTimeout(() => runUploadCleanup().catch(e => console.error('[CLEANUP] startup error:', e)), 5 * 60 * 1000);

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

    if (this.trialExpirationEnrollmentInterval) {
      clearInterval(this.trialExpirationEnrollmentInterval);
      this.trialExpirationEnrollmentInterval = null;
    }

    if (this.legislativeMonitoringInterval) {
      clearInterval(this.legislativeMonitoringInterval);
      this.legislativeMonitoringInterval = null;
    }

    if (this.emailSequenceInterval) {
      clearInterval(this.emailSequenceInterval);
      this.emailSequenceInterval = null;
    }

    if (this.renewalReminderInterval) {
      clearInterval(this.renewalReminderInterval);
      this.renewalReminderInterval = null;
    }

    if (this.uploadCleanupInterval) {
      clearInterval(this.uploadCleanupInterval);
      this.uploadCleanupInterval = null;
    }

    console.log('✅ Scheduled jobs stopped');
  }
}

export const scheduledJobs = new ScheduledJobs();
