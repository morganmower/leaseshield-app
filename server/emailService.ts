// Email notification service for LeaseShield App
import { Resend } from 'resend';
import { storage } from './storage';
import { aiContentService } from './aiContentService';
import { getUncachableResendClient } from './resend';
import type { EmailSequenceStep, User } from '@shared/schema';

interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

interface EmailRecipient {
  email: string;
  firstName?: string;
  lastName?: string;
}

export class EmailService {
  private getBaseUrl(): string {
    return process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://leaseshieldapp.com';
  }

  /**
   * Helper method to send email via Resend API with fallback
   * Consolidates duplicate Resend email sending logic
   */
  private async sendViaResend(
    to: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): Promise<{ success: boolean; resendId?: string; error?: string }> {
    if (!process.env.RESEND_API_KEY) {
      console.log('📧 Resend API - Would send email:');
      console.log(`  To: ${to}`);
      console.log(`  Subject: ${subject}`);
      console.log('  ⚠️  RESEND_API_KEY not set - email not actually sent');
      return { success: false };
    }

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: 'LeaseShield App <support@leaseshieldapp.com>',
        to,
        subject,
        html: htmlBody,
        text: textBody,
      });

      if (result.error) {
        console.error(`❌ Failed to send email to ${to}:`, result.error);
        return { success: false, error: result.error.message };
      }

      console.log(`✅ Email sent to ${to} (${subject})`);
      return { success: true, resendId: result.data?.id };
    } catch (error: any) {
      console.error(`❌ Error sending email to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  private async sendEmail(to: EmailRecipient, template: EmailTemplate): Promise<boolean> {
    try {
      // Try to use the Resend connector first
      try {
        const { client, fromEmail } = await getUncachableResendClient();
        const result = await client.emails.send({
          from: `LeaseShield App <${fromEmail}>`,
          to: to.email,
          subject: template.subject,
          html: template.htmlBody,
          text: template.textBody,
        });
        
        if (result.error) {
          console.error(`❌ Failed to send email to ${to.email}:`, result.error);
          return false;
        }
        
        console.log(`✅ Email sent to ${to.email} (${template.subject})`);
        return true;
      } catch (connectorError) {
        // Fallback to RESEND_API_KEY if connector fails
        const result = await this.sendViaResend(to.email, template.subject, template.htmlBody, template.textBody);
        return result.success;
      }
    } catch (error) {
      console.error(`❌ Error sending email to ${to.email}:`, error);
      return false;
    }
  }

  async sendTrialReminderEmail(user: EmailRecipient, trialEndsAt: Date): Promise<boolean> {
    const daysRemaining = Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const firstName = user.firstName || 'there';

    const template: EmailTemplate = {
      subject: `Your LeaseShield trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
      textBody: `Hi ${firstName},

Your 7-day free trial of LeaseShield App ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.

Ready to protect your rental business? You have two options:

🎁 OPTION 1: Continue with a subscription
• Monthly: Just $10/month
• Yearly: Only $100/year (save $20!)
• Full access to all templates, compliance tools, and tenant screening helpers

⚡ OPTION 2: Or keep your trial experience going
If you want to keep exploring before committing, you can continue your free trial access.

What you get:
✓ State-specific legal templates for all 15 states
✓ Compliance cards keeping you up-to-date with landlord-tenant laws
✓ AI credit report decoder and tenant screening toolkit
✓ Step-by-step workflows for handling tenant issues
✓ 24/7 AI chat assistant

Subscribe today and lock in these exclusive prices: ${this.getBaseUrl()}/subscribe

Questions? We're here to help.

Best regards,
The LeaseShield App Team
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #475569 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .pricing-box { background: #f0fdf4; border: 2px solid #22c55e; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .pricing-option { display: inline-block; width: 45%; margin-right: 5%; vertical-align: top; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .feature-list { background: #f0fdfa; padding: 20px; border-left: 4px solid #14b8a6; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">⏰ Your trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <p>Your 7-day free trial of <strong>LeaseShield App</strong> ends in <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</strong>.</p>

      <p><strong>Ready to protect your rental business? You have two options:</strong></p>

      <div class="pricing-box">
        <h3 style="margin-top: 0; color: #22c55e;">✓ OPTION 1: Subscribe Today</h3>
        <div class="pricing-option">
          <strong>Monthly:</strong><br>
          Just $10/month
        </div>
        <div class="pricing-option">
          <strong>Yearly (Best Value):</strong><br>
          $100/year (Save $20!)
        </div>
        <div style="clear: both;"></div>
        <p style="margin-bottom: 0;"><em>Lock in these exclusive prices today</em></p>
      </div>

      <p style="text-align: center;">
        <a href="${this.getBaseUrl()}/subscribe" class="cta-button">
          Subscribe Now
        </a>
      </p>

      <p style="text-align: center; color: #64748b;">
        Or <a href="${this.getBaseUrl()}/login" style="color: #14b8a6;">continue exploring your trial</a>
      </p>
      
      <div class="feature-list">
        <p style="margin-top: 0;"><strong>What you get with LeaseShield:</strong></p>
        <ul style="margin-bottom: 0;">
          <li>State-specific legal templates for all 15 states</li>
          <li>Compliance cards keeping you up-to-date</li>
          <li>AI credit report decoder and screening toolkit</li>
          <li>Step-by-step tenant issue workflows</li>
          <li>24/7 AI chat assistant for landlord questions</li>
        </ul>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Questions? We're here to help.</p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  async sendLegalUpdateEmail(user: EmailRecipient, updateTitle: string, updateSummary: string, stateId: string, impactLevel: string): Promise<boolean> {
    const firstName = user.firstName || 'there';
    const urgencyText = impactLevel === 'high' ? '🚨 HIGH PRIORITY' : impactLevel === 'medium' ? '⚠️ IMPORTANT' : 'ℹ️ FYI';

    const template: EmailTemplate = {
      subject: `${urgencyText}: New ${stateId} Law - ${updateTitle}`,
      textBody: `Hi ${firstName},

${urgencyText}

There's a new legal update affecting ${stateId} landlords:

${updateTitle}

${updateSummary}

This change has been flagged as ${impactLevel} impact to your rental business.

Log in to LeaseShield App to read the full details, including before/after comparison and why this matters to you: ${this.getBaseUrl()}/compliance

Stay compliant and protected,
The LeaseShield App Team
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${impactLevel === 'high' ? '#dc2626' : impactLevel === 'medium' ? '#ea580c' : '#475569'}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .alert-box { background: ${impactLevel === 'high' ? '#fef2f2' : impactLevel === 'medium' ? '#fff7ed' : '#f0fdfa'}; padding: 20px; border-left: 4px solid ${impactLevel === 'high' ? '#dc2626' : impactLevel === 'medium' ? '#ea580c' : '#14b8a6'}; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${urgencyText}</h1>
      <p style="margin: 10px 0 0 0; font-size: 18px;">New ${stateId} Landlord-Tenant Law</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <div class="alert-box">
        <h2 style="margin-top: 0; color: ${impactLevel === 'high' ? '#991b1b' : impactLevel === 'medium' ? '#9a3412' : '#1e40af'};">${updateTitle}</h2>
        <p>${updateSummary}</p>
        <p style="margin-bottom: 0;"><strong>Impact Level:</strong> ${impactLevel.charAt(0).toUpperCase() + impactLevel.slice(1)}</p>
      </div>

      <p>This legal change affects landlords in <strong>${stateId}</strong>. Log in to LeaseShield App to read the full details, including:</p>
      <ul>
        <li>Before/after comparison of the law</li>
        <li>Why this matters to your rental business</li>
        <li>Updated templates incorporating this change</li>
      </ul>

      <center>
        <a href="${this.getBaseUrl()}/compliance" class="cta-button">
          View Legal Update
        </a>
      </center>

      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Stay compliant and protected with LeaseShield App.</p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  async sendSubscriptionConfirmationEmail(user: EmailRecipient): Promise<boolean> {
    const firstName = user.firstName || 'there';

    const template: EmailTemplate = {
      subject: 'Welcome to LeaseShield App! Your subscription is active',
      textBody: `Hi ${firstName},

Welcome to LeaseShield App! Your subscription is now active.

You now have unlimited access to:
• State-specific legal templates for all 15 states
• Real-time compliance updates and legal change notifications
• Credit report decoder and tenant screening resources
• Expert guidance for handling tenant issues

Start protecting your rental business: ${this.getBaseUrl()}/dashboard

Need help getting started? Visit our Help Center or reach out anytime.

Best regards,
The LeaseShield App Team
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .feature-list { background: #f1f5f9; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 32px;">Welcome to LeaseShield App!</h1>
      <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Your subscription is now active</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <p>Thank you for subscribing to <strong>LeaseShield App</strong>! You now have unlimited access to our complete platform.</p>

      <div class="feature-list">
        <p style="margin-top: 0;"><strong>Here's what you can do now:</strong></p>
        <ul>
          <li>Download state-specific legal templates for all 15 states</li>
          <li>Get real-time compliance updates and legal change notifications</li>
          <li>Decode credit reports and screen tenants with confidence</li>
          <li>Access expert guidance for handling tenant issues</li>
        </ul>
      </div>

      <center>
        <a href="${this.getBaseUrl()}/dashboard" class="cta-button">
          Go to Dashboard
        </a>
      </center>

      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Need help getting started? Visit our Help Center or reach out anytime.</p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
      <p style="margin-top: 5px; font-size: 12px;">Manage your subscription in <a href="${this.getBaseUrl()}/settings" style="color: #14b8a6;">Settings</a></p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }
  async sendPasswordResetEmail(user: EmailRecipient, resetToken: string): Promise<boolean> {
    const firstName = user.firstName || 'there';
    
    // Build the reset URL
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const template: EmailTemplate = {
      subject: 'Reset your LeaseShield App password',
      textBody: `Hi ${firstName},

We received a request to reset your password for your LeaseShield App account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The LeaseShield App Team
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #475569 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .warning-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <p>We received a request to reset the password for your LeaseShield App account.</p>

      <center>
        <a href="${resetUrl}" class="cta-button" style="display: inline-block; background-color: #14b8a6; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600;">
          Reset Your Password
        </a>
      </center>

      <p style="text-align: center; font-size: 14px; color: #64748b;">
        Or copy and paste this link into your browser:<br>
        <a href="${resetUrl}" style="color: #14b8a6; word-break: break-all;">${resetUrl}</a>
      </p>

      <div class="warning-box">
        <p style="margin: 0;"><strong>This link will expire in 1 hour</strong> for security reasons.</p>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">
        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  async sendApplicationDecisionEmail(
    applicant: EmailRecipient, 
    decision: 'approved' | 'denied',
    propertyAddress: string,
    landlordInfo?: { name?: string; businessName?: string; phoneNumber?: string }
  ): Promise<boolean> {
    const firstName = applicant.firstName || 'Applicant';
    const isApproved = decision === 'approved';
    const displayName = landlordInfo?.businessName || landlordInfo?.name;
    const contactInfo = landlordInfo?.phoneNumber ? `\n\nContact: ${landlordInfo.phoneNumber}` : '';
    
    const template: EmailTemplate = {
      subject: isApproved 
        ? `Great news! Your rental application has been approved`
        : `Update on your rental application`,
      textBody: isApproved 
        ? `Hi ${firstName},

Great news! Your rental application for ${propertyAddress} has been approved.

${displayName ? `${displayName} will` : 'The landlord will'} be in touch with you soon regarding next steps, including signing the lease and move-in details.${contactInfo}

Congratulations on your new home!

Best regards,
LeaseShield App
`
        : `Hi ${firstName},

Thank you for your interest in ${propertyAddress}.

After careful consideration, the landlord has decided not to move forward with your application at this time.

If your application was denied based on information from a credit report or background check, you have the right to:
- Request a free copy of the report used in making this decision
- Dispute any inaccurate information with the reporting agency

We wish you the best in your housing search.

Best regards,
LeaseShield App
`,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${isApproved ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #475569 0%, #1e293b 100%)'}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .info-box { background: ${isApproved ? '#ecfdf5' : '#f8fafc'}; border: 1px solid ${isApproved ? '#10b981' : '#cbd5e1'}; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${isApproved ? 'Application Approved!' : 'Application Update'}</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      ${isApproved ? `
      <p>Great news! Your rental application for <strong>${propertyAddress}</strong> has been <strong style="color: #10b981;">approved</strong>.</p>
      
      <div class="info-box">
        <p style="margin: 0;">${displayName ? `${displayName} will` : 'The landlord will'} be in touch with you soon regarding next steps, including:</p>
        <ul style="margin-bottom: 0;">
          <li>Signing the lease agreement</li>
          <li>Security deposit and first month's rent</li>
          <li>Move-in date and key pickup</li>
        </ul>
        ${landlordInfo?.phoneNumber ? `<p style="margin-top: 12px; margin-bottom: 0;"><strong>Contact:</strong> ${landlordInfo.phoneNumber}</p>` : ''}
      </div>
      
      <p>Congratulations on your new home!</p>
      ` : `
      <p>Thank you for your interest in <strong>${propertyAddress}</strong>.</p>
      
      <p>After careful consideration, the landlord has decided not to move forward with your application at this time.</p>
      
      <div class="info-box">
        <p style="margin-top: 0;"><strong>Your Rights:</strong></p>
        <p style="margin-bottom: 0;">If your application was denied based on information from a credit report or background check, you have the right to:</p>
        <ul style="margin-bottom: 0;">
          <li>Request a free copy of the report used in making this decision</li>
          <li>Dispute any inaccurate information with the reporting agency</li>
        </ul>
      </div>
      
      <p>We wish you the best in your housing search.</p>
      `}
    </div>
    
    <div class="footer">
      <p>This message was sent via LeaseShield App on behalf of the property owner.</p>
      <p>© ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(applicant, template);
  }

  async sendCustomDecisionEmail(
    recipientEmail: string, 
    subject: string,
    body: string
  ): Promise<boolean> {
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 8px; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      ${body.split('\n').map(line => `<p style="margin: 0 0 12px 0;">${line || '&nbsp;'}</p>`).join('')}
    </div>
    
    <div class="footer">
      <p>This message was sent via LeaseShield App on behalf of the property owner.</p>
    </div>
  </div>
</body>
</html>
    `;

    const template: EmailTemplate = {
      subject,
      textBody: body,
      htmlBody,
    };

    return this.sendEmail({ email: recipientEmail }, template);
  }

  async sendTrialExpiredEmail(user: EmailRecipient): Promise<boolean> {
    const firstName = user.firstName || 'there';

    const template: EmailTemplate = {
      subject: 'Your LeaseShield App trial has ended - Subscribe now',
      textBody: `Hi ${firstName},

Your 7-day free trial of LeaseShield App has ended.

To continue protecting your rental business, please subscribe for just $10/month:
• State-specific legal templates for all 15 states
• Real-time compliance updates and legal change notifications
• Credit report decoder and tenant screening resources
• Expert guidance for handling tenant issues

Reactivate your subscription: ${this.getBaseUrl()}/settings

If you have questions or need assistance, reach out anytime.

Best regards,
The LeaseShield App Team
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .alert-box { background: #fef2f2; padding: 20px; border-left: 4px solid #dc2626; margin: 20px 0; }
    .feature-list { background: #f0fdfa; padding: 20px; border-left: 4px solid #14b8a6; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Your trial has ended</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <div class="alert-box">
        <p style="margin: 0; color: #991b1b;"><strong>Your 7-day free trial of LeaseShield App has ended.</strong></p>
      </div>

      <p>You still have access to view your previous data, but to continue using LeaseShield App and protecting your rental business, please subscribe for just <strong>$10/month</strong>.</p>

      <div class="feature-list">
        <p style="margin-top: 0;"><strong>With your subscription, you'll get:</strong></p>
        <ul>
          <li>State-specific legal templates for all 15 states</li>
          <li>Real-time compliance updates and legal change notifications</li>
          <li>Credit report decoder and tenant screening resources</li>
          <li>Expert guidance for handling tenant issues</li>
        </ul>
      </div>

      <center>
        <a href="${this.getBaseUrl()}/settings" class="cta-button">
          Reactivate Subscription
        </a>
      </center>

      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Questions? We're here to help. Contact support anytime.</p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  async sendPaymentFailedEmail(user: EmailRecipient): Promise<boolean> {
    const firstName = user.firstName || 'there';
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://leaseshieldapp.com';

    const template: EmailTemplate = {
      subject: 'Action required: Your LeaseShield payment failed',
      textBody: `Hi ${firstName},

We were unable to process your LeaseShield App subscription payment.

To continue using LeaseShield and protect your rental business, please update your payment method:

${baseUrl}/subscription

What happens next:
- Your access remains active while we retry the payment
- We'll attempt to charge your card again in a few days
- If payment continues to fail, your subscription will be paused

Need help? Reply to this email or contact us anytime.

Best regards,
The LeaseShield App Team
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .alert-box { background: #fef2f2; padding: 20px; border-left: 4px solid #dc2626; margin: 20px 0; }
    .info-box { background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Payment Failed</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <div class="alert-box">
        <p style="margin: 0; color: #991b1b;"><strong>We were unable to process your LeaseShield App subscription payment.</strong></p>
      </div>

      <p>To continue using LeaseShield and protecting your rental business, please update your payment method:</p>

      <center>
        <a href="${baseUrl}/subscription" class="cta-button" style="color: #ffffff !important;">
          Update Payment Method
        </a>
      </center>

      <div class="info-box">
        <p style="margin-top: 0;"><strong>What happens next:</strong></p>
        <ul style="margin-bottom: 0;">
          <li>Your access remains active while we retry the payment</li>
          <li>We'll attempt to charge your card again in a few days</li>
          <li>If payment continues to fail, your subscription will be paused</li>
        </ul>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Need help? Reply to this email or contact us anytime.</p>
    </div>
    
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  async sendRenewalReminderEmail(user: EmailRecipient, renewalDate: Date, amount: number = 100): Promise<boolean> {
    const firstName = user.firstName || 'there';
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://leaseshieldapp.com';
    
    const formattedDate = renewalDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const daysUntilRenewal = Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    const template: EmailTemplate = {
      subject: `Your LeaseShield subscription renews in ${daysUntilRenewal} days`,
      textBody: `Hi ${firstName},

Your LeaseShield App annual subscription will automatically renew on ${formattedDate} for $${amount}.

You don't need to do anything - your subscription will continue uninterrupted.

If you'd like to:
- Update your payment method: ${baseUrl}/subscription
- Switch to monthly billing: ${baseUrl}/subscription
- Cancel your subscription: ${baseUrl}/subscription

Your subscription includes:
- State-specific legal templates for all 15 states
- Real-time compliance updates and legal change notifications
- AI credit report decoder and tenant screening resources
- Expert guidance for handling tenant issues
- 24/7 AI chat assistant

Thank you for being a LeaseShield subscriber!

Best regards,
The LeaseShield App Team
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #475569 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .renewal-box { background: #f0fdfa; border: 2px solid #14b8a6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .feature-list { background: #f1f5f9; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; font-weight: 600; }
    .secondary-link { display: inline-block; color: #14b8a6; padding: 12px 24px; text-decoration: none; margin: 10px 5px; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Subscription Renewal Notice</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <div class="renewal-box">
        <p style="margin: 0; font-size: 18px;">Your annual subscription renews in</p>
        <p style="margin: 10px 0; font-size: 36px; font-weight: bold; color: #14b8a6;">${daysUntilRenewal} days</p>
        <p style="margin: 0; color: #64748b;">${formattedDate} &bull; $${amount}/year</p>
      </div>

      <p><strong>You don't need to do anything</strong> - your subscription will continue uninterrupted and you'll keep full access to all LeaseShield features.</p>

      <div class="feature-list">
        <p style="margin-top: 0;"><strong>Your subscription includes:</strong></p>
        <ul style="margin-bottom: 0;">
          <li>State-specific legal templates for all 15 states</li>
          <li>Real-time compliance updates and legal change notifications</li>
          <li>AI credit report decoder and tenant screening resources</li>
          <li>Expert guidance for handling tenant issues</li>
          <li>24/7 AI chat assistant</li>
        </ul>
      </div>

      <p style="text-align: center;">Need to make changes?</p>
      <center>
        <a href="${baseUrl}/subscription" class="cta-button" style="color: #ffffff !important;">
          Manage Subscription
        </a>
      </center>

      <p style="margin-top: 30px; font-size: 14px; color: #64748b; text-align: center;">Thank you for being a LeaseShield subscriber!</p>
    </div>
    
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  async sendContactFormEmail(formData: { firstName: string; lastName: string; email: string; phone: string; message: string }): Promise<boolean> {
    const { firstName, lastName, email, phone, message } = formData;

    const template: EmailTemplate = {
      subject: `New Contact Form Submission from ${firstName} ${lastName}`,
      textBody: `New contact form submission from LeaseShield App website:

Name: ${firstName} ${lastName}
Email: ${email}
Phone: ${phone}

Message:
${message}

---
Sent from LeaseShield App Contact Form
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #475569 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .info-box { background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .message-box { background: #ffffff; border: 2px solid #14b8a6; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
    .label { font-weight: 600; color: #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📬 New Contact Form Submission</h1>
    </div>
    <div class="content">
      <p><strong>New contact request from LeaseShield App website</strong></p>
      
      <div class="info-box">
        <p style="margin: 5px 0;"><span class="label">Name:</span> ${firstName} ${lastName}</p>
        <p style="margin: 5px 0;"><span class="label">Email:</span> <a href="mailto:${email}">${email}</a></p>
        <p style="margin: 5px 0;"><span class="label">Phone:</span> ${phone}</p>
      </div>

      <div class="message-box">
        <p class="label">Message:</p>
        <p style="margin-top: 10px; white-space: pre-wrap;">${message}</p>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">
        Reply to <a href="mailto:${email}">${email}</a> to respond to this inquiry.
      </p>
    </div>
    
    <div class="footer">
      <p>Sent from LeaseShield App Contact Form</p>
      <p>© ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    // Send to support email
    return this.sendEmail(
      { email: 'support@leaseshieldapp.com', firstName: 'Support', lastName: 'Team' },
      template
    );
  }

  // AI-powered email methods
  async sendAIEmail(
    user: User,
    step: EmailSequenceStep,
    sequenceId: string,
    emailType: 'sequence' | 'transactional' | 'notification' = 'sequence'
  ): Promise<{ success: boolean; resendId?: string }> {
    if (!user.email) {
      console.error(`❌ Cannot send email to user ${user.id} - no email address`);
      return { success: false };
    }

    try {
      const content = await aiContentService.generateEmailContent(
        user.id,
        step.aiPrompt || '',
        step.subject,
        step.fallbackBody
      );

      // Send email via Resend
      const sendResult = await this.sendViaResend(user.email, content.subject, content.htmlBody, content.textBody);

      if (!sendResult.success) {
        await storage.createEmailEvent({
          userId: user.id,
          email: user.email,
          sequenceId,
          stepId: step.id,
          emailType,
          subject: content.subject,
          status: 'failed',
          aiGenerated: content.isAiGenerated,
          aiContentCached: content.isAiGenerated ? content.textBody : null,
          metadata: { error: sendResult.error },
        });

        return { success: false };
      }

      const resendId = sendResult.resendId;

      await storage.createEmailEvent({
        userId: user.id,
        email: user.email,
        resendId,
        sequenceId,
        stepId: step.id,
        emailType,
        subject: content.subject,
        status: 'sent',
        aiGenerated: content.isAiGenerated,
        aiContentCached: content.isAiGenerated ? content.textBody : null,
      });

      console.log(`✅ AI email sent to ${user.email} (${content.subject})`);
      return { success: true, resendId };
    } catch (error) {
      console.error(`❌ Error sending AI email to ${user.email}:`, error);
      
      try {
        await storage.createEmailEvent({
          userId: user.id,
          email: user.email,
          sequenceId,
          stepId: step.id,
          emailType,
          subject: step.subject,
          status: 'failed',
          aiGenerated: false,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      } catch (logError) {
        console.error('Failed to log email error:', logError);
      }
      
      return { success: false };
    }
  }

  async sendWelcomeEmail(user: User): Promise<boolean> {
    if (!user.email) return false;

    try {
      const content = await aiContentService.generateWelcomeEmail(user.id);

      const sendResult = await this.sendViaResend(user.email, content.subject, content.htmlBody, content.textBody);

      if (sendResult.success) {
        await storage.createEmailEvent({
          userId: user.id,
          email: user.email,
          resendId: sendResult.resendId,
          emailType: 'transactional',
          subject: content.subject,
          status: 'sent',
          aiGenerated: content.isAiGenerated,
          aiContentCached: content.isAiGenerated ? content.textBody : null,
        });
        console.log(`✅ Welcome email sent to ${user.email}`);
      }

      return sendResult.success;
    } catch (error) {
      console.error('❌ Error sending welcome email:', error);
      return false;
    }
  }

  async sendDocumentConfirmationEmail(user: User, templateTitle: string): Promise<boolean> {
    if (!user.email) return false;

    try {
      const content = await aiContentService.generateDocumentDownloadConfirmation(user.id, templateTitle);

      const sendResult = await this.sendViaResend(user.email, content.subject, content.htmlBody, content.textBody);

      if (sendResult.success) {
        await storage.createEmailEvent({
          userId: user.id,
          email: user.email,
          resendId: sendResult.resendId,
          emailType: 'transactional',
          subject: content.subject,
          status: 'sent',
          aiGenerated: content.isAiGenerated,
          aiContentCached: content.isAiGenerated ? content.textBody : null,
          metadata: { templateTitle },
        });
        console.log(`✅ Document confirmation email sent to ${user.email}`);
      }

      return sendResult.success;
    } catch (error) {
      console.error('❌ Error sending document confirmation email:', error);
      return false;
    }
  }

  async sendReengagementEmail(user: User): Promise<boolean> {
    if (!user.email) return false;

    try {
      const content = await aiContentService.generateReengagementEmail(user.id);

      const sendResult = await this.sendViaResend(user.email, content.subject, content.htmlBody, content.textBody);

      if (sendResult.success) {
        await storage.createEmailEvent({
          userId: user.id,
          email: user.email,
          resendId: sendResult.resendId,
          emailType: 'transactional',
          subject: content.subject,
          status: 'sent',
          aiGenerated: content.isAiGenerated,
          aiContentCached: content.isAiGenerated ? content.textBody : null,
        });
        console.log(`✅ Re-engagement email sent to ${user.email}`);
      }

      return sendResult.success;
    } catch (error) {
      console.error('❌ Error sending re-engagement email:', error);
      return false;
    }
  }
  async sendScreeningCredentialsSetupNotification(landlord: User, adminEmails: string[]): Promise<boolean> {
    if (!adminEmails.length) {
      console.log('📧 No admin emails to notify about screening credentials setup');
      return false;
    }

    const landlordName = landlord.firstName && landlord.lastName 
      ? `${landlord.firstName} ${landlord.lastName}` 
      : landlord.email;
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://leaseshieldapp.com';

    const template: EmailTemplate = {
      subject: `Action Required: Set Invitation ID for ${landlordName}`,
      textBody: `Hi Admin,

A landlord has set up their Western Verify screening credentials and is waiting for you to configure their invitation ID.

Landlord: ${landlordName}
Email: ${landlord.email}

Please log in to the admin dashboard to set their invitation ID so they can start using tenant screening:
${baseUrl}/admin/screening-credentials

Best regards,
LeaseShield App
`,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #475569 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .info-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Screening Credentials Setup</h1>
    </div>
    <div class="content">
      <div class="info-box">
        <strong>Action Required:</strong> A landlord needs their invitation ID configured.
      </div>
      <p><strong>Landlord:</strong> ${landlordName}</p>
      <p><strong>Email:</strong> ${landlord.email}</p>
      <p>They have successfully set up their Western Verify credentials and are waiting for you to assign their invitation ID.</p>
      <a href="${baseUrl}/admin/screening-credentials" class="cta-button">Set Invitation ID</a>
      <div class="footer">
        <p>LeaseShield App - Protecting Your Rental Business</p>
      </div>
    </div>
  </div>
</body>
</html>
`,
    };

    let success = false;
    for (const adminEmail of adminEmails) {
      const sent = await this.sendEmail({ email: adminEmail }, template);
      if (sent) success = true;
    }
    return success;
  }

  async sendScreeningReadyNotification(landlord: User): Promise<boolean> {
    if (!landlord.email) return false;

    const firstName = landlord.firstName || 'there';
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://leaseshieldapp.com';

    const template: EmailTemplate = {
      subject: 'Your Tenant Screening Integration is Ready!',
      textBody: `Hi ${firstName},

Great news! Your Western Verify tenant screening integration is now fully configured and ready to use.

You can now submit tenant screening requests directly through your LeaseShield dashboard. When a rental applicant submits their application, you'll have the option to request a background check through Western Verify.

Get started:
${baseUrl}/rental-submissions

If you have any questions about using the screening feature, our AI assistant is available 24/7 to help.

Best regards,
The LeaseShield App Team
`,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .success-box { background: #dcfce7; border: 1px solid #22c55e; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .feature-list { background: #f0fdfa; padding: 20px; border-left: 4px solid #14b8a6; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Screening Integration Ready!</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      <div class="success-box">
        <strong>Great news!</strong> Your Western Verify tenant screening integration is now fully configured and ready to use.
      </div>
      <div class="feature-list">
        <h3>What you can do now:</h3>
        <ul>
          <li>Request background checks on rental applicants</li>
          <li>View screening results directly in your dashboard</li>
          <li>Make informed decisions with comprehensive tenant data</li>
        </ul>
      </div>
      <a href="${baseUrl}/rental-submissions" class="cta-button">View Rental Applications</a>
      <p>If you have any questions, our AI assistant is available 24/7 to help.</p>
      <div class="footer">
        <p>LeaseShield App - Protecting Your Rental Business</p>
      </div>
    </div>
  </div>
</body>
</html>
`,
    };

    return await this.sendEmail({ email: landlord.email, firstName: landlord.firstName || undefined }, template);
  }

  async sendCoApplicantInviteEmail(
    invitee: { email: string; firstName: string; lastName: string },
    inviter: { firstName: string; lastName: string },
    propertyName: string,
    inviteUrl: string,
    role: 'coapplicant' | 'guarantor',
    landlordInfo?: { businessName?: string; phoneNumber?: string }
  ): Promise<boolean> {
    const roleLabel = role === 'guarantor' ? 'Guarantor' : 'Co-Applicant';
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://leaseshieldapp.com';
    const fullInviteUrl = `${baseUrl}${inviteUrl}`;
    const landlordDisplay = landlordInfo?.businessName || 'the property manager';
    const contactInfo = landlordInfo?.phoneNumber ? `\n\nProperty Contact: ${landlordInfo.phoneNumber}` : '';

    const template: EmailTemplate = {
      subject: `You've been invited to join a rental application for ${propertyName}`,
      textBody: `Hi ${invitee.firstName},

${inviter.firstName} ${inviter.lastName} has invited you to join their rental application for ${propertyName} as a ${roleLabel}.

To complete your portion of the application, please click the link below:

${fullInviteUrl}

What you'll need to provide:
- Personal information (name, contact details)
- Address history
- Employment information
- Consent for background/credit screening

This link is unique to you. Please do not share it with anyone else.

If you have any questions, please contact ${inviter.firstName} directly.${contactInfo}

Thank you,
LeaseShield App
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .invite-box { background: #f0fdfa; border: 2px solid #14b8a6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 16px; }
    .checklist { background: #f8fafc; padding: 20px; border-left: 4px solid #14b8a6; margin: 20px 0; }
    .checklist ul { margin: 0; padding-left: 20px; }
    .checklist li { margin: 8px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
    .warning { font-size: 13px; color: #64748b; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're Invited!</h1>
      <p style="margin: 0; opacity: 0.9;">${roleLabel} Application Request</p>
    </div>
    <div class="content">
      <p>Hi ${invitee.firstName},</p>
      <div class="invite-box">
        <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>${inviter.firstName} ${inviter.lastName}</strong> has invited you to join their rental application for:</p>
        <p style="margin: 0; font-size: 20px; color: #0d9488; font-weight: 600;">${propertyName}</p>
      </div>
      <p>To complete your portion of the application as a <strong>${roleLabel}</strong>, please click the button below:</p>
      <div style="text-align: center;">
        <a href="${fullInviteUrl}" class="cta-button">Complete Your Application</a>
      </div>
      <div class="checklist">
        <h3 style="margin-top: 0;">What you'll need to provide:</h3>
        <ul>
          <li>Personal information (name, contact details, ID)</li>
          <li>Address history (last 2+ years)</li>
          <li>Employment information</li>
          <li>Consent for background/credit screening</li>
        </ul>
      </div>
      <p class="warning">This link is unique to you. Please do not share it with anyone else.</p>
      ${landlordInfo?.phoneNumber ? `<p style="font-size: 14px; color: #475569; margin-top: 16px;"><strong>Property Contact:</strong> ${landlordInfo.phoneNumber}</p>` : ''}
      <div class="footer">
        <p>LeaseShield App - Protecting Your Rental Business</p>
      </div>
    </div>
  </div>
</body>
</html>
`,
    };

    return await this.sendEmail({ email: invitee.email, firstName: invitee.firstName }, template);
  }
  async sendScreeningCompleteNotification(
    owner: { email: string; firstName?: string },
    personName: string,
    propertyName: string,
    unitName: string,
    submissionUrl: string
  ): Promise<boolean> {
    if (!owner.email) return false;

    const firstName = owner.firstName || 'there';
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://leaseshieldapp.com';
    const fullUrl = `${baseUrl}${submissionUrl}`;

    const template: EmailTemplate = {
      subject: `Screening Complete: ${personName} - ${propertyName}`,
      textBody: `Hi ${firstName},

Great news! The tenant screening for ${personName} at ${propertyName} (${unitName}) is now complete.

You can now view the screening results in your LeaseShield dashboard:

${fullUrl}

The report includes background check information to help you make an informed decision on this rental application.

Best regards,
The LeaseShield App Team
`,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .success-box { background: #dcfce7; border: 1px solid #22c55e; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .detail-box { background: #f0fdfa; padding: 20px; border-left: 4px solid #14b8a6; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Screening Complete</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      <div class="success-box">
        <strong>Good news!</strong> The tenant screening results are now available.
      </div>
      <div class="detail-box">
        <p><strong>Applicant:</strong> ${personName}</p>
        <p><strong>Property:</strong> ${propertyName}</p>
        <p><strong>Unit:</strong> ${unitName}</p>
      </div>
      <p>View the full screening report to make an informed decision on this rental application:</p>
      <a href="${fullUrl}" class="cta-button">View Screening Results</a>
      <div class="footer">
        <p>LeaseShield App - Protecting Your Rental Business</p>
      </div>
    </div>
  </div>
</body>
</html>
`,
    };

    return await this.sendEmail({ email: owner.email, firstName: owner.firstName }, template);
  }

  async sendDirectMessageNotification(
    user: EmailRecipient,
    subject: string,
    messagePreview: string
  ): Promise<boolean> {
    const firstName = user.firstName || 'there';
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'https://leaseshieldapp.com';
    const messagesUrl = `${baseUrl}/messages`;

    const template: EmailTemplate = {
      subject: `New Message from LeaseShield: ${subject}`,
      textBody: `Hi ${firstName},

You have a new message from the LeaseShield team!

Subject: ${subject}

Message Preview:
${messagePreview.substring(0, 200)}${messagePreview.length > 200 ? '...' : ''}

Log in to your LeaseShield account to read and reply to this message:
${messagesUrl}

Best regards,
The LeaseShield App Team
`,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #14b8a6 0%, #0f766e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .message-box { background: #f0fdfa; border-left: 4px solid #14b8a6; padding: 20px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; font-size: 16px; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">You Have a New Message</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <p>You have a new message from the <strong>LeaseShield</strong> team!</p>

      <div class="message-box">
        <p style="margin-top: 0;"><strong>Subject:</strong> ${subject}</p>
        <p style="margin-bottom: 0; color: #64748b;">${messagePreview.substring(0, 200)}${messagePreview.length > 200 ? '...' : ''}</p>
      </div>

      <p style="text-align: center;">
        <a href="${messagesUrl}" class="cta-button">
          Read & Reply Now
        </a>
      </p>

      <p style="text-align: center; color: #64748b; font-size: 14px;">
        Click the button above to view the full message and respond.
      </p>

      <div class="footer">
        <p>LeaseShield App - Protecting Your Rental Business</p>
      </div>
    </div>
  </div>
</body>
</html>
`,
    };

    return await this.sendEmail({ email: user.email, firstName: user.firstName }, template);
  }

  async sendAdminPaymentNotification(
    adminEmail: string,
    customerEmail: string,
    amountPaid: number,
    planType: string,
    customerName?: string
  ): Promise<boolean> {
    const formattedAmount = (amountPaid / 100).toFixed(2);
    const displayName = customerName || customerEmail;
    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'America/Denver', 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });

    const template: EmailTemplate = {
      subject: `New Payment Received - $${formattedAmount} from ${displayName}`,
      textBody: `New LeaseShield Payment Received!

Customer: ${displayName}
Email: ${customerEmail}
Amount: $${formattedAmount}
Plan: ${planType}
Time: ${timestamp}

View your Stripe dashboard for more details.
`,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #14b8a6 0%, #0f766e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .details-box { background: #f0fdfa; border-left: 4px solid #14b8a6; padding: 20px; margin: 20px 0; }
    .amount { font-size: 32px; font-weight: bold; color: #14b8a6; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">New Payment Received</h1>
    </div>
    <div class="content">
      <p style="text-align: center;">
        <span class="amount">$${formattedAmount}</span>
      </p>
      
      <div class="details-box">
        <p style="margin-top: 0;"><strong>Customer:</strong> ${displayName}</p>
        <p><strong>Email:</strong> ${customerEmail}</p>
        <p><strong>Plan:</strong> ${planType}</p>
        <p style="margin-bottom: 0;"><strong>Time:</strong> ${timestamp}</p>
      </div>

      <p style="text-align: center; color: #64748b; font-size: 14px;">
        View your <a href="https://dashboard.stripe.com" style="color: #14b8a6;">Stripe Dashboard</a> for more details.
      </p>

      <div class="footer">
        <p>LeaseShield App - Admin Notification</p>
      </div>
    </div>
  </div>
</body>
</html>
`,
    };

    return await this.sendEmail({ email: adminEmail }, template);
  }

  // =========================================================================
  // NEW LIFECYCLE EMAILS (3-email strategy: signup, 3-day nudge, close loop)
  // =========================================================================

  /**
   * Email #1: Sent immediately after signup
   * Pure framing email - no pricing, no CTA, mental positioning only
   */
  async sendSignupWelcomeEmail(user: EmailRecipient): Promise<boolean> {
    const firstName = user.firstName || 'there';

    const template: EmailTemplate = {
      subject: 'Welcome to LeaseShield',
      textBody: `Hi ${firstName},

I'm Morgan, and I built LeaseShield because landlords shouldn't have to figure out screening decisions and compliance alone.

Most landlords only face these decisions a few times per year.
LeaseShield is there when they do.

Inside, you'll find:
- State-specific legal templates that match your state's laws
- Compliance guidance that explains what matters and why
- A screening decoder that helps make sense of reports
- Clear workflows for handling tenant issues the right way

You don't need to use this every day.
It's here for the moments that matter.

- Morgan
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: #ffffff; padding: 30px; }
    .feature-list { margin: 24px 0; padding-left: 0; }
    .feature-list li { margin-bottom: 8px; }
    .signature { margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <p>I'm Morgan, and I built LeaseShield because landlords shouldn't have to figure out screening decisions and compliance alone.</p>

      <p><strong>Most landlords only face these decisions a few times per year.</strong><br>
      LeaseShield is there when they do.</p>

      <p>Inside, you'll find:</p>
      <ul class="feature-list">
        <li>State-specific legal templates that match your state's laws</li>
        <li>Compliance guidance that explains what matters and why</li>
        <li>A screening decoder that helps make sense of reports</li>
        <li>Clear workflows for handling tenant issues the right way</li>
      </ul>

      <p>You don't need to use this every day.<br>
      It's here for the moments that matter.</p>

      <div class="signature">
        <p style="margin-bottom: 0;">- Morgan</p>
      </div>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  /**
   * Email #2: Sent 3 days after signup IF user has NOT subscribed
   * Calm nudge - no "checking in", no "browse for free", no buttons
   */
  async sendThreeDayNudgeEmail(user: EmailRecipient): Promise<boolean> {
    const firstName = user.firstName || 'there';

    const template: EmailTemplate = {
      subject: 'Quick note',
      textBody: `Hi ${firstName},

Quick note.

Most landlords don't think about tools like LeaseShield until a screening report raises questions.
That's exactly when it tends to click.

If you want it ready before the next applicant shows up, you can activate anytime from your account.
If not, no rush - it's there when you need it.

- Morgan
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: #ffffff; padding: 30px; }
    .signature { margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <p>Quick note.</p>

      <p>Most landlords don't think about tools like LeaseShield until a screening report raises questions.<br>
      That's exactly when it tends to click.</p>

      <p>If you want it ready before the next applicant shows up, you can activate anytime from your account.<br>
      If not, no rush - it's there when you need it.</p>

      <div class="signature">
        <p style="margin-bottom: 0;">- Morgan</p>
      </div>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  /**
   * Email #3: Sent 10-14 days after signup IF user has NOT subscribed
   * Close the loop, then silence. Respectful goodbye.
   */
  async sendCloseTheLoopEmail(user: EmailRecipient): Promise<boolean> {
    const firstName = user.firstName || 'there';

    const template: EmailTemplate = {
      subject: 'Still here if you need us',
      textBody: `Hi ${firstName},

This is my last email unless you activate your account.

I know not everyone needs LeaseShield right now, and that's okay. Landlord needs come in waves. A lease renewal. A tricky tenant situation. A background check that doesn't make sense.

When those moments come, we'll be here.

If you'd like to activate now, it's $10/month or $100/year. If not, no hard feelings. Your account stays active so you can come back anytime.

Thanks for giving LeaseShield a look.

Best,
Morgan
      `,
      htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
    .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
    .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .highlight-box { background: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Still here if you need us</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <p>This is my last email unless you activate your account.</p>

      <p>I know not everyone needs LeaseShield right now, and that's okay. Landlord needs come in waves. A lease renewal. A tricky tenant situation. A background check that doesn't make sense.</p>

      <p><strong>When those moments come, we'll be here.</strong></p>

      <div class="highlight-box">
        <p style="margin: 0;"><strong>$10/month</strong> or <strong>$100/year</strong></p>
        <a href="${this.getBaseUrl()}/subscribe" class="cta-button" style="margin-top: 15px; margin-bottom: 0;">
          Activate Now
        </a>
      </div>

      <p style="color: #64748b;">If not, no hard feelings. Your account stays active so you can come back anytime.</p>

      <div class="signature">
        <p style="margin-bottom: 5px;">Thanks for giving LeaseShield a look.</p>
        <p style="margin-bottom: 5px;">Best,<br><strong>Morgan</strong></p>
      </div>
    </div>
    
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  /**
   * Send a bi-weekly legislative digest email summarizing new updates for a user's state
   * Includes both state-specific updates and federal/HUD updates that apply to all landlords
   */
  async sendBiweeklyLegislativeDigest(
    user: EmailRecipient,
    stateUpdates: Array<{ title: string; summary: string; impactLevel: string; category?: string; stateId: string }>,
    federalUpdates: Array<{ title: string; summary: string; impactLevel: string; category?: string }>,
    templateChanges: Array<{ title: string; versionNotes: string }>,
    digestPeriod: string,
    userState: string
  ): Promise<boolean> {
    const firstName = user.firstName || 'there';
    const totalUpdates = stateUpdates.length + federalUpdates.length + templateChanges.length;
    
    if (totalUpdates === 0) {
      return false; // No updates to send
    }

    const stateNames: Record<string, string> = {
      'UT': 'Utah', 'TX': 'Texas', 'ND': 'North Dakota', 'SD': 'South Dakota',
      'NC': 'North Carolina', 'OH': 'Ohio', 'MI': 'Michigan', 'ID': 'Idaho',
      'WY': 'Wyoming', 'CA': 'California', 'VA': 'Virginia', 'NV': 'Nevada',
      'AZ': 'Arizona', 'FL': 'Florida', 'IL': 'Illinois', 'NM': 'New Mexico'
    };
    const stateName = stateNames[userState] || userState;

    const getImpactBadge = (level: string) => {
      const colors: Record<string, string> = {
        high: '#dc2626',
        medium: '#ea580c', 
        low: '#6b7280'
      };
      return colors[level] || colors.low;
    };

    // Build update sections
    const buildUpdateItem = (update: { title: string; summary: string; impactLevel: string }, badge: string) => `
      <div style="border-left: 3px solid ${getImpactBadge(update.impactLevel)}; padding-left: 16px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500;">${badge}</span>
          <span style="background: ${getImpactBadge(update.impactLevel)}22; color: ${getImpactBadge(update.impactLevel)}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; text-transform: uppercase;">${update.impactLevel}</span>
        </div>
        <h4 style="margin: 4px 0 8px 0; color: #0f172a; font-size: 15px; font-weight: 600;">${update.title}</h4>
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">${update.summary}</p>
      </div>
    `;

    const stateSection = stateUpdates.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          ${stateName} Updates (${stateUpdates.length})
        </h3>
        ${stateUpdates.map(u => buildUpdateItem(u, stateName)).join('')}
      </div>
    ` : '';

    const federalSection = federalUpdates.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          Federal & HUD Updates (${federalUpdates.length})
        </h3>
        ${federalUpdates.map(u => buildUpdateItem(u, (u as any).category === 'section8' ? 'Section 8 / HUD' : 'Federal')).join('')}
      </div>
    ` : '';

    const templateSection = templateChanges.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 16px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          Template Updates (${templateChanges.length})
        </h3>
        ${templateChanges.map(t => `
          <div style="border-left: 3px solid #14b8a6; padding-left: 16px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 15px; font-weight: 600;">${t.title}</h4>
            <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">${t.versionNotes || 'Updated for legal compliance'}</p>
          </div>
        `).join('')}
      </div>
    ` : '';

    const template: EmailTemplate = {
      subject: `LeaseShield Update: ${totalUpdates} new landlord-tenant ${totalUpdates === 1 ? 'update' : 'updates'} for ${stateName}`,
      textBody: `Hi ${firstName},

Here's your bi-weekly digest of landlord-tenant law updates for ${digestPeriod}.

${stateUpdates.length > 0 ? `${stateName} UPDATES (${stateUpdates.length}):\n${stateUpdates.map(u => `- ${u.title}: ${u.summary}`).join('\n')}\n\n` : ''}
${federalUpdates.length > 0 ? `FEDERAL & HUD UPDATES (${federalUpdates.length}):\n${federalUpdates.map(u => `- ${u.title}: ${u.summary}`).join('\n')}\n\n` : ''}
${templateChanges.length > 0 ? `TEMPLATE UPDATES (${templateChanges.length}):\n${templateChanges.map(t => `- ${t.title}: ${t.versionNotes || 'Updated for legal compliance'}`).join('\n')}\n\n` : ''}

View all updates and download updated templates: ${this.getBaseUrl()}/legal-updates

Stay protected,
The LeaseShield Team
      `,
      htmlBody: `
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
            <td style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); padding: 32px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                LeaseShield Bi-Weekly Digest
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0f2f1; font-size: 14px;">
                ${digestPeriod} • ${stateName}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                Hi ${firstName}, here's a summary of ${totalUpdates} landlord-tenant ${totalUpdates === 1 ? 'update' : 'updates'} from the past two weeks that may affect your rental business.
              </p>

              ${stateSection}
              ${federalSection}
              ${templateSection}

              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="${this.getBaseUrl()}/legal-updates" 
                   style="display: inline-block; background-color: #14b8a6; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                  View All Updates
                </a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 13px;">
                You're receiving this because you opted in to legislative update notifications.
              </p>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px;">
                <a href="${this.getBaseUrl()}/settings" style="color: #14b8a6;">Manage notification preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }

  /**
   * Send rent reminder email to tenant N days before due date
   */
  async sendRentReminderEmail(
    to: { email: string; tenantName: string },
    opts: {
      landlordName: string;
      amountDollars: string;
      dueDate: string;
      propertyName?: string | null;
      paymentLink: string;
      lateFeeDollars?: string;
      gracePeriodDays?: number;
    }
  ): Promise<boolean> {
    const lateFeeNote = opts.lateFeeDollars && Number(opts.lateFeeDollars) > 0
      ? `<p style="margin: 16px 0; color: #b45309;"><strong>Heads up:</strong> A late fee of $${opts.lateFeeDollars} applies if rent is not paid within ${opts.gracePeriodDays || 5} days of the due date.</p>`
      : '';
    const propertyLine = opts.propertyName ? `<p style="margin: 4px 0; color: #555;">Property: ${opts.propertyName}</p>` : '';
    const subject = `Rent reminder: $${opts.amountDollars} due ${opts.dueDate}`;
    const htmlBody = `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">Rent Reminder</h2>
        <p>Hi ${to.tenantName || 'there'},</p>
        <p>This is a friendly reminder that your rent payment of <strong>$${opts.amountDollars}</strong> is due on <strong>${opts.dueDate}</strong>.</p>
        ${propertyLine}
        <p style="margin: 24px 0;">
          <a href="${opts.paymentLink}" style="background: #2563eb; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Pay Rent Online (ACH - No Card Fees)</a>
        </p>
        ${lateFeeNote}
        <p style="color: #555; font-size: 14px;">Paying by bank transfer (ACH) is free — no credit card processing fees.</p>
        <p style="color: #555; font-size: 14px;">Thank you,<br/>${opts.landlordName}</p>
      </div>
    `;
    const textBody = `Hi ${to.tenantName || 'there'},\n\nReminder: rent of $${opts.amountDollars} is due on ${opts.dueDate}.${opts.propertyName ? `\nProperty: ${opts.propertyName}` : ''}\n\nPay online (ACH, no card fees): ${opts.paymentLink}\n\n${opts.lateFeeDollars && Number(opts.lateFeeDollars) > 0 ? `Late fee of $${opts.lateFeeDollars} applies after ${opts.gracePeriodDays || 5} day grace period.\n\n` : ''}Thank you,\n${opts.landlordName}`;
    return this.sendEmail({ email: to.email, firstName: to.tenantName }, { subject, htmlBody, textBody });
  }

  /**
   * Send rent payment receipt email to tenant when payment succeeds
   */
  async sendRentReceiptEmail(
    to: { email: string; tenantName: string },
    opts: {
      landlordName: string;
      amountDollars: string;
      paidDate: string;
      propertyName?: string | null;
      receiptUrl?: string | null;
      rentDollars?: string | null;
      serviceFeeDollars?: string | null;
    }
  ): Promise<boolean> {
    const subject = `Payment received: $${opts.amountDollars}`;
    const propertyLine = opts.propertyName ? `<p style="margin: 4px 0; color: #555;">Property: ${opts.propertyName}</p>` : '';
    const receiptLink = opts.receiptUrl ? `<p style="margin: 16px 0;"><a href="${opts.receiptUrl}" style="color: #2563eb;">View Stripe receipt</a></p>` : '';

    const showItemization = opts.rentDollars != null;
    const showServiceFeeRow =
      showItemization &&
      opts.serviceFeeDollars != null &&
      Number(opts.serviceFeeDollars) > 0;

    const serviceFeeRowHtml = showServiceFeeRow
      ? `
          <tr>
            <td style="padding: 6px 0; color: #555;">Service fee</td>
            <td style="padding: 6px 0; text-align: right; color: #111;">$${opts.serviceFeeDollars}</td>
          </tr>`
      : '';

    const itemizationHtml = showItemization
      ? `
        <table style="width: 100%; max-width: 420px; margin: 16px 0; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #555;">Rent</td>
            <td style="padding: 6px 0; text-align: right; color: #111;">$${opts.rentDollars}</td>
          </tr>${serviceFeeRowHtml}
          <tr>
            <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; color: #111; font-weight: 600;">Total paid</td>
            <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; text-align: right; color: #111; font-weight: 600;">$${opts.amountDollars}</td>
          </tr>
        </table>
      `
      : '';

    const itemizationText = showItemization
      ? `\nRent:        $${opts.rentDollars}\n${showServiceFeeRow ? `Service fee: $${opts.serviceFeeDollars}\n` : ''}Total paid:  $${opts.amountDollars}\n`
      : '';

    const htmlBody = `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #047857;">Payment Received</h2>
        <p>Hi ${to.tenantName || 'there'},</p>
        <p>We received your rent payment of <strong>$${opts.amountDollars}</strong> on ${opts.paidDate}.</p>
        ${propertyLine}
        ${itemizationHtml}
        <p style="color: #555;">ACH payments typically take 3-5 business days to fully clear. We'll mark your account paid in full once funds settle.</p>
        ${receiptLink}
        <p style="color: #555; font-size: 14px;">Keep this receipt for your records — it itemizes the rent and any service fee for tax or expense reporting.</p>
        <p style="color: #555; font-size: 14px;">Thank you,<br/>${opts.landlordName}</p>
      </div>
    `;
    const textBody = `Hi ${to.tenantName || 'there'},\n\nWe received your rent payment of $${opts.amountDollars} on ${opts.paidDate}.${opts.propertyName ? `\nProperty: ${opts.propertyName}` : ''}\n${itemizationText}\nACH payments take 3-5 business days to clear.\n${opts.receiptUrl ? `Receipt: ${opts.receiptUrl}\n` : ''}\nKeep this receipt for your records.\n\nThank you,\n${opts.landlordName}`;
    return this.sendEmail({ email: to.email, firstName: to.tenantName }, { subject, htmlBody, textBody });
  }

  /**
   * Notify the landlord that a tenant rent payment succeeded, with an
   * itemized breakdown of rent, service fee (and who paid it), platform fee,
   * and the net amount expected to land in their bank account.
   */
  async sendLandlordRentPaymentNotification(
    to: { email: string; firstName?: string },
    opts: {
      tenantName: string;
      paidDate: string;
      propertyName?: string | null;
      rentDollars: string;
      serviceFeeDollars: string;
      serviceFeePayer: 'tenant' | 'landlord' | 'none';
      platformFeeDollars: string;
      tenantTotalDollars: string;
      netToLandlordDollars: string;
    }
  ): Promise<boolean> {
    const subject = `Rent payment received from ${opts.tenantName}: $${opts.rentDollars}`;
    const propertyLine = opts.propertyName
      ? `<p style="margin: 4px 0; color: #555;">Property: ${opts.propertyName}</p>` : '';

    const feePayerLabel =
      opts.serviceFeePayer === 'tenant'
        ? 'Service fee (paid by tenant)'
        : opts.serviceFeePayer === 'landlord'
          ? 'Service fee (paid by you)'
          : 'Service fee';

    const showServiceFee = Number(opts.serviceFeeDollars) > 0;
    const showPlatformFee = Number(opts.platformFeeDollars) > 0;

    const rows: string[] = [];
    rows.push(`
      <tr>
        <td style="padding: 6px 0; color: #555;">Rent</td>
        <td style="padding: 6px 0; text-align: right; color: #111;">$${opts.rentDollars}</td>
      </tr>`);
    if (showServiceFee) {
      rows.push(`
      <tr>
        <td style="padding: 6px 0; color: #555;">${feePayerLabel}</td>
        <td style="padding: 6px 0; text-align: right; color: #111;">$${opts.serviceFeeDollars}</td>
      </tr>`);
    }
    rows.push(`
      <tr>
        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; color: #111; font-weight: 600;">Tenant paid</td>
        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; text-align: right; color: #111; font-weight: 600;">$${opts.tenantTotalDollars}</td>
      </tr>`);
    if (showPlatformFee) {
      rows.push(`
      <tr>
        <td style="padding: 6px 0; color: #555;">LeaseShield platform fee</td>
        <td style="padding: 6px 0; text-align: right; color: #111;">−$${opts.platformFeeDollars}</td>
      </tr>`);
    }
    rows.push(`
      <tr>
        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; color: #047857; font-weight: 600;">Net to your account</td>
        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb; text-align: right; color: #047857; font-weight: 600;">$${opts.netToLandlordDollars}</td>
      </tr>`);

    const htmlBody = `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #047857;">Rent Payment Received</h2>
        <p>Hi ${to.firstName || 'there'},</p>
        <p><strong>${opts.tenantName}</strong> just paid rent on ${opts.paidDate}.</p>
        ${propertyLine}
        <table style="width: 100%; max-width: 460px; margin: 16px 0; border-collapse: collapse; font-size: 14px;">
          ${rows.join('')}
        </table>
        <p style="color: #555; font-size: 14px;">ACH payments typically take 3-5 business days to settle into your bank account.</p>
        <p style="color: #555; font-size: 14px;">— LeaseShield</p>
      </div>
    `;
    const textLines: string[] = [];
    textLines.push(`Hi ${to.firstName || 'there'},`);
    textLines.push('');
    textLines.push(`${opts.tenantName} just paid rent on ${opts.paidDate}.`);
    if (opts.propertyName) textLines.push(`Property: ${opts.propertyName}`);
    textLines.push('');
    textLines.push(`Rent:                    $${opts.rentDollars}`);
    if (showServiceFee) textLines.push(`${feePayerLabel}: $${opts.serviceFeeDollars}`);
    textLines.push(`Tenant paid:             $${opts.tenantTotalDollars}`);
    if (showPlatformFee) textLines.push(`LeaseShield platform fee: -$${opts.platformFeeDollars}`);
    textLines.push(`Net to your account:     $${opts.netToLandlordDollars}`);
    textLines.push('');
    textLines.push('ACH payments typically settle in 3-5 business days.');
    textLines.push('');
    textLines.push('— LeaseShield');
    const textBody = textLines.join('\n');

    return this.sendEmail(
      { email: to.email, firstName: to.firstName },
      { subject, htmlBody, textBody },
    );
  }

  /**
   * Send the auto-pay authorization link to a tenant. Includes plain-language
   * disclosure of the recurring debit terms — the formal NACHA mandate text
   * is shown on the authorization page itself.
   */
  async sendRentAutoPayAuthorizationEmail(
    to: { email: string; tenantName: string },
    opts: {
      landlordName: string;
      amountDollars: string;
      dayOfMonth: number;
      startDate: string;
      propertyName?: string | null;
      authorizationLink: string;
    }
  ): Promise<boolean> {
    const ord = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const propertyLine = opts.propertyName
      ? `<p style="margin: 4px 0; color: #555;">Property: ${opts.propertyName}</p>` : '';
    const subject = `Authorize automatic rent payments for ${opts.landlordName}`;
    const htmlBody = `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">Set up automatic rent payments</h2>
        <p>Hi ${to.tenantName || 'there'},</p>
        <p>${opts.landlordName} would like to set up automatic monthly rent debits from your bank account.</p>
        ${propertyLine}
        <ul style="color: #333; line-height: 1.6;">
          <li>Amount: <strong>$${opts.amountDollars}</strong> per month</li>
          <li>Charged on the <strong>${ord(opts.dayOfMonth)}</strong> of each month</li>
          <li>Starting: <strong>${opts.startDate}</strong></li>
          <li>Paid by bank transfer (ACH) — no card processing fees</li>
        </ul>
        <p style="margin: 24px 0;">
          <a href="${opts.authorizationLink}" style="background: #2DD4BF; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600;">Review & Authorize Auto-Pay</a>
        </p>
        <p style="color: #666; font-size: 13px;">You can cancel auto-pay any time from this page. NACHA rules apply to all ACH debits, and you have the right to dispute unauthorized debits with your bank.</p>
        <p style="color: #555; font-size: 14px;">Thanks,<br/>${opts.landlordName}</p>
      </div>
    `;
    const textBody = `Hi ${to.tenantName || 'there'},

${opts.landlordName} would like to set up automatic monthly rent debits from your bank account.${opts.propertyName ? `\nProperty: ${opts.propertyName}` : ''}

- Amount: $${opts.amountDollars}/month
- Charged on the ${ord(opts.dayOfMonth)} of each month
- Starting: ${opts.startDate}
- Paid by bank transfer (ACH) - no card processing fees

Review & authorize: ${opts.authorizationLink}

You can cancel any time from the authorization page.

Thanks,
${opts.landlordName}`;
    return this.sendEmail({ email: to.email, firstName: to.tenantName }, { subject, htmlBody, textBody });
  }

  /**
   * Notify the landlord when a tenant revokes an auto-pay mandate.
   */
  async sendRentAutoPayRevokedEmail(
    to: { email: string; firstName?: string },
    opts: { tenantName: string; tenantEmail: string; amountDollars: string }
  ): Promise<boolean> {
    const subject = `${opts.tenantName} canceled auto-pay`;
    const htmlBody = `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #b45309;">Auto-pay canceled</h2>
        <p>Hi ${to.firstName || 'there'},</p>
        <p><strong>${opts.tenantName}</strong> (${opts.tenantEmail}) just canceled their automatic rent payments of $${opts.amountDollars}/month through LeaseShield.</p>
        <p>No more debits will be attempted under this authorization. You'll need to invoice them manually or send a new auto-pay authorization link.</p>
        <p style="color: #555; font-size: 14px;">— LeaseShield</p>
      </div>
    `;
    const textBody = `Hi ${to.firstName || 'there'},

${opts.tenantName} (${opts.tenantEmail}) just canceled their automatic rent payments of $${opts.amountDollars}/month through LeaseShield.

No more debits will be attempted under this authorization. You'll need to invoice them manually or send a new auto-pay authorization link.

- LeaseShield`;
    return this.sendEmail({ email: to.email, firstName: to.firstName || '' }, { subject, htmlBody, textBody });
  }
}

export const emailService = new EmailService();
