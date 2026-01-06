// Scheduled jobs for LeaseShield App
// In production, this would use a proper job queue like Bull, Agenda, or node-cron

import { storage } from "./storage";
import { emailService } from "./emailService";
import { db } from "./db";
import { users, analyticsEvents } from "@shared/schema";
import { and, eq, lt, gte, sql } from "drizzle-orm";
import { runMonthlyLegislativeMonitoring } from "./legislativeMonitoring";
import { setupEmailSequences } from "./emailSequenceSetup";
import { runUploadCleanup } from "./cleanup";

// Landlord tips pool - rotates biweekly (every 2 weeks)
export const LANDLORD_TIPS = [
  {
    title: "Fair Housing Refresher",
    summary: "Consistency is your best protection against discrimination claims.",
    content: "Apply the same screening criteria to every applicant. Document your process and keep records of all applications, even rejected ones. This creates a clear paper trail showing equal treatment.",
    actionItem: "Review your screening checklist to ensure it's applied uniformly to all applicants.",
  },
  {
    title: "Security Deposit Best Practices",
    summary: "A thorough move-in inspection prevents disputes at move-out.",
    content: "Take detailed photos and videos during move-in inspections. Have the tenant sign a condition checklist. This documentation is essential if you need to make deductions from the security deposit later.",
    actionItem: "Create a standardized move-in checklist if you don't have one already.",
  },
  {
    title: "Maintenance Response Times",
    summary: "Quick response to repairs builds tenant trust and protects your property.",
    content: "Establish clear timelines: emergencies within 24 hours, urgent issues within 48 hours, routine repairs within a week. Document all maintenance requests and your responses.",
    actionItem: "Set up a simple system to track maintenance requests and response times.",
  },
  {
    title: "Late Rent Collection Strategy",
    summary: "Be consistent but reasonable when handling late payments.",
    content: "Apply late fees consistently according to your lease terms. Communicate early when rent is overdue - many payment issues stem from simple oversights. Document all communications about late rent.",
    actionItem: "Review your late rent policy and ensure it's clearly stated in your lease.",
  },
  {
    title: "Annual Lease Review",
    summary: "Update your lease annually to reflect legal changes.",
    content: "Laws change regularly, and your lease should too. Review state-specific requirements annually. LeaseShield notifies you when templates are updated for legal compliance - use those updated versions.",
    actionItem: "Check your LeaseShield dashboard for any template updates you may have missed.",
  },
  {
    title: "Tenant Communication Tips",
    summary: "Professional, written communication prevents misunderstandings.",
    content: "Keep important communications in writing (email or text). Be professional but friendly. Respond to tenant inquiries within 24-48 hours. Good communication leads to longer tenancies.",
    actionItem: "Set up a dedicated email or phone number for tenant communications.",
  },
  {
    title: "Property Inspection Schedule",
    summary: "Regular inspections catch problems early.",
    content: "Schedule routine property inspections (with proper notice) at least twice a year. Look for maintenance issues, lease violations, and safety hazards. Document findings with photos.",
    actionItem: "Add property inspection reminders to your calendar for each rental unit.",
  },
  {
    title: "Insurance Review Reminder",
    summary: "Ensure your coverage matches your property's current value.",
    content: "Review your landlord insurance annually. Confirm coverage amounts, liability limits, and any gaps in protection. Require renters insurance from tenants to protect their belongings.",
    actionItem: "Contact your insurance agent to review your policy before renewal.",
  },
  {
    title: "Rent Increase Timing",
    summary: "Strategic timing and proper notice make rent increases smoother.",
    content: "Check your state's notice requirements for rent increases - they vary widely. Time increases with lease renewals when possible. Consider market conditions and the value of retaining good tenants.",
    actionItem: "Research your state's required notice period for rent increases.",
  },
  {
    title: "Emergency Preparedness",
    summary: "Being prepared for emergencies protects tenants and your investment.",
    content: "Ensure tenants know how to shut off water, gas, and electricity. Provide emergency contact information. Have a plan for natural disasters common to your area. Keep spare keys accessible.",
    actionItem: "Create an emergency procedures document for each rental property.",
  },
  {
    title: "Lease Violation Response",
    summary: "Address violations promptly but fairly to maintain a good landlord-tenant relationship.",
    content: "Document every violation with dates and photos. Start with a friendly reminder for first offenses. Follow your lease terms exactly when escalating. Keep copies of all notices sent.",
    actionItem: "Review your lease to understand the specific violation procedures it outlines.",
  },
  {
    title: "Tenant Retention Strategies",
    summary: "Keeping good tenants is more cost-effective than finding new ones.",
    content: "Respond quickly to maintenance requests. Consider small upgrades between leases. Be reasonable on minor issues. A vacancy costs more than most rent concessions - calculate the true cost before losing a good tenant.",
    actionItem: "List three things you could improve to make your rental more desirable to current tenants.",
  },
  {
    title: "Move-Out Procedure Clarity",
    summary: "Clear expectations prevent disputes and ensure smooth transitions.",
    content: "Provide a written move-out checklist 30 days before lease end. Explain cleaning expectations and how to avoid deductions. Schedule the walkthrough in advance and invite the tenant to attend.",
    actionItem: "Create a move-out instruction sheet if you don't already have one.",
  },
  {
    title: "Screening Red Flags",
    summary: "Know what to look for without crossing Fair Housing boundaries.",
    content: "Focus on verifiable facts: income verification, rental history, credit patterns. Contact previous landlords directly. Verify employment. Be wary of anyone who wants to skip steps or pay extra to bypass screening.",
    actionItem: "Document your standard screening criteria and apply it consistently.",
  },
  {
    title: "Record Keeping Basics",
    summary: "Good records protect you legally and simplify tax time.",
    content: "Keep all leases, correspondence, and financial records for at least 7 years. Organize by property and year. Use LeaseShield's document storage to keep everything in one secure place.",
    actionItem: "Set up a filing system (digital or physical) for each rental property.",
  },
  {
    title: "Pet Policy Considerations",
    summary: "A clear pet policy protects your property while expanding your tenant pool.",
    content: "Decide on pet policies before listing. Consider pet deposits or monthly pet rent. Be specific about size, breed, and number limits. Remember: service animals and emotional support animals have different legal requirements.",
    actionItem: "Review and update your pet policy, including understanding service animal laws.",
  },
];

export class ScheduledJobs {
  private trialReminderInterval: NodeJS.Timeout | null = null;
  private trialExpiryInterval: NodeJS.Timeout | null = null;
  private trialExpirationEnrollmentInterval: NodeJS.Timeout | null = null;
  private legislativeMonitoringInterval: NodeJS.Timeout | null = null;
  private emailSequenceInterval: NodeJS.Timeout | null = null;
  private renewalReminderInterval: NodeJS.Timeout | null = null;
  private uploadCleanupInterval: NodeJS.Timeout | null = null;
  private weeklyTipsInterval: NodeJS.Timeout | null = null;
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

  // Send biweekly tips to users who have opted in (every 2 weeks)
  async sendBiweeklyTips(): Promise<void> {
    try {
      console.log('💡 Sending biweekly landlord tips...');

      // Get biweek number of the year to determine which tip to send
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const weekNumber = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const biweekNumber = Math.floor(weekNumber / 2); // Every 2 weeks
      const tipIndex = biweekNumber % LANDLORD_TIPS.length;
      const tip = LANDLORD_TIPS[tipIndex];

      console.log(`  Selected tip ${tipIndex + 1}/${LANDLORD_TIPS.length}: "${tip.title}" (biweek ${biweekNumber})`);

      // Get all active users who have opted in to tips
      const usersWantingTips = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.subscriptionStatus, 'active'),
            eq(users.notifyTips, true)
          )
        );

      console.log(`  Found ${usersWantingTips.length} users opted in for tips`);

      if (usersWantingTips.length === 0) {
        console.log('✅ No users to send tips to');
        return;
      }

      // Check if we already sent this biweek's tip (track by biweek + year)
      const tipKey = `${now.getFullYear()}-biweek${biweekNumber}`;
      
      let sentCount = 0;
      for (const user of usersWantingTips) {
        if (!user.email) continue;

        // Check if user already received this biweek's tip
        const [existingTipEvent] = await db
          .select()
          .from(analyticsEvents)
          .where(
            and(
              eq(analyticsEvents.userId, user.id),
              eq(analyticsEvents.eventType, 'biweekly_tip_sent'),
              sql`${analyticsEvents.eventData}->>'tipKey' = ${tipKey}`
            )
          )
          .limit(1);

        if (existingTipEvent) {
          console.log(`  Skipping ${user.email} - already received tip for ${tipKey}`);
          continue; // Already sent this tip to this user
        }

        // Send the tip email
        await this.sendTipEmail(user, tip);

        // Track that we sent this tip
        await storage.trackEvent({
          userId: user.id,
          eventType: 'biweekly_tip_sent',
          eventData: { tipKey, tipTitle: tip.title },
        });

        sentCount++;
      }

      console.log(`✅ Biweekly tips sent to ${sentCount} users`);
    } catch (error) {
      console.error('❌ Error sending biweekly tips:', error);
    }
  }

  private async sendTipEmail(user: any, tip: typeof LANDLORD_TIPS[0]): Promise<void> {
    const { getUncachableResendClient } = await import('./resend');
    const { client, fromEmail } = await getUncachableResendClient();
    
    const firstName = user.firstName || 'there';
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://leaseshieldapp.com';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 24px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                LeaseShield Tip of the Week
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 18px; font-weight: 500;">
                Hi ${firstName},
              </p>
              
              <div style="background-color: #f0fdfa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 8px 0; color: #0d9488; font-size: 18px; font-weight: 600;">
                  ${tip.title}
                </h2>
                <p style="margin: 0; color: #475569; font-size: 14px; font-style: italic;">
                  ${tip.summary}
                </p>
              </div>

              <p style="margin: 0 0 20px 0; color: #334155; font-size: 15px; line-height: 1.7;">
                ${tip.content}
              </p>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Action Item:</strong> ${tip.actionItem}
                </p>
              </div>

              <div style="text-align: center; margin-top: 32px;">
                <a href="${baseUrl}/dashboard" 
                   style="display: inline-block; background-color: #14b8a6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  Go to Dashboard
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                You're receiving this because you opted in to Tips & Best Practices.
                <br>
                <a href="${baseUrl}/settings" style="color: #64748b;">Manage preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
LeaseShield Tip of the Week

Hi ${firstName},

${tip.title}
${tip.summary}

${tip.content}

ACTION ITEM: ${tip.actionItem}

Visit your dashboard: ${baseUrl}/dashboard

---
You're receiving this because you opted in to Tips & Best Practices.
Manage preferences: ${baseUrl}/settings
    `;

    await client.emails.send({
      from: fromEmail,
      to: user.email,
      subject: `Landlord Tip: ${tip.title}`,
      html,
      text,
    });
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

    // Send biweekly tips every 14 days (check daily, but only send once per 2 weeks)
    this.weeklyTipsInterval = setInterval(
      () => this.sendBiweeklyTips(),
      24 * 60 * 60 * 1000 // Check daily
    );
    setTimeout(() => this.sendBiweeklyTips(), 6 * 60 * 1000); // First check after 6 minutes

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

    if (this.weeklyTipsInterval) {
      clearInterval(this.weeklyTipsInterval);
      this.weeklyTipsInterval = null;
    }

    console.log('✅ Scheduled jobs stopped');
  }
}

export const scheduledJobs = new ScheduledJobs();
