// Email notification service for LeaseShield App
// In production, this would integrate with SendGrid, Postmark, or similar service

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
  private async sendEmail(to: EmailRecipient, template: EmailTemplate): Promise<boolean> {
    // In production, this would call the actual email API (SendGrid, Postmark, etc.)
    // For MVP, we'll log the email details
    console.log('📧 Email Service - Sending email:');
    console.log(`  To: ${to.email} (${to.firstName} ${to.lastName})`);
    console.log(`  Subject: ${template.subject}`);
    console.log(`  Body Preview: ${template.textBody.substring(0, 100)}...`);
    
    // Simulate successful send
    return true;
  }

  async sendTrialReminderEmail(user: EmailRecipient, trialEndsAt: Date): Promise<boolean> {
    const daysRemaining = Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const firstName = user.firstName || 'there';

    const template: EmailTemplate = {
      subject: `Your LeaseShield App trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
      textBody: `Hi ${firstName},

Your 7-day free trial of LeaseShield App ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.

Don't lose access to:
• State-specific legal templates for UT, TX, ND, SD
• Compliance cards keeping you up-to-date with landlord-tenant laws
• Credit report decoder and tenant screening toolkit
• Step-by-step workflows for handling tenant issues

Continue your subscription for just $10/month and keep your rental business protected.

Log in to manage your subscription: ${process.env.REPLIT_DOMAINS || 'https://leaseshieldapp.com'}/settings

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
    .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .feature-list { background: #f1f5f9; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0; }
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
      
      <div class="feature-list">
        <p style="margin-top: 0;"><strong>Don't lose access to:</strong></p>
        <ul>
          <li>State-specific legal templates for UT, TX, ND, SD</li>
          <li>Compliance cards keeping you up-to-date with landlord-tenant laws</li>
          <li>Credit report decoder and tenant screening toolkit</li>
          <li>Step-by-step workflows for handling tenant issues</li>
        </ul>
      </div>

      <p>Continue your subscription for just <strong>$10/month</strong> and keep your rental business protected.</p>

      <center>
        <a href="${process.env.REPLIT_DOMAINS || 'https://leaseshieldapp.com'}/settings" class="cta-button">
          Manage Subscription
        </a>
      </center>

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

Log in to LeaseShield App to read the full details, including before/after comparison and why this matters to you: ${process.env.REPLIT_DOMAINS || 'https://leaseshieldapp.com'}/compliance

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
    .alert-box { background: ${impactLevel === 'high' ? '#fef2f2' : impactLevel === 'medium' ? '#fff7ed' : '#f1f5f9'}; padding: 20px; border-left: 4px solid ${impactLevel === 'high' ? '#dc2626' : impactLevel === 'medium' ? '#ea580c' : '#2563eb'}; margin: 20px 0; }
    .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
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
        <a href="${process.env.REPLIT_DOMAINS || 'https://leaseshieldapp.com'}/compliance" class="cta-button">
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
• State-specific legal templates for UT, TX, ND, SD
• Real-time compliance updates and legal change notifications
• Credit report decoder and tenant screening resources
• Expert guidance for handling tenant issues

Start protecting your rental business: ${process.env.REPLIT_DOMAINS || 'https://leaseshieldapp.com'}/dashboard

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
    .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 32px;">🎉 Welcome to LeaseShield App!</h1>
      <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Your subscription is now active</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      
      <p>Thank you for subscribing to <strong>LeaseShield App</strong>! You now have unlimited access to our complete platform.</p>

      <div class="feature-list">
        <p style="margin-top: 0;"><strong>Here's what you can do now:</strong></p>
        <ul>
          <li>Download state-specific legal templates for UT, TX, ND, SD</li>
          <li>Get real-time compliance updates and legal change notifications</li>
          <li>Decode credit reports and screen tenants with confidence</li>
          <li>Access expert guidance for handling tenant issues</li>
        </ul>
      </div>

      <center>
        <a href="${process.env.REPLIT_DOMAINS || 'https://leaseshieldapp.com'}/dashboard" class="cta-button">
          Go to Dashboard
        </a>
      </center>

      <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Need help getting started? Visit our Help Center or reach out anytime.</p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} LeaseShield App. All rights reserved.</p>
      <p style="margin-top: 5px; font-size: 12px;">Manage your subscription in <a href="${process.env.REPLIT_DOMAINS || 'https://leaseshieldapp.com'}/settings" style="color: #2563eb;">Settings</a></p>
    </div>
  </div>
</body>
</html>
      `,
    };

    return this.sendEmail(user, template);
  }
  async sendTrialExpiredEmail(user: EmailRecipient): Promise<boolean> {
    const firstName = user.firstName || 'there';

    const template: EmailTemplate = {
      subject: 'Your LeaseShield App trial has ended - Subscribe now',
      textBody: `Hi ${firstName},

Your 7-day free trial of LeaseShield App has ended.

To continue protecting your rental business, please subscribe for just $10/month:
• State-specific legal templates for UT, TX, ND, SD
• Real-time compliance updates and legal change notifications
• Credit report decoder and tenant screening resources
• Expert guidance for handling tenant issues

Reactivate your subscription: ${process.env.REPLIT_DOMAINS || 'https://leaseshieldapp.com'}/settings

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
    .feature-list { background: #f1f5f9; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0; }
    .cta-button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
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
          <li>State-specific legal templates for UT, TX, ND, SD</li>
          <li>Real-time compliance updates and legal change notifications</li>
          <li>Credit report decoder and tenant screening resources</li>
          <li>Expert guidance for handling tenant issues</li>
        </ul>
      </div>

      <center>
        <a href="${process.env.REPLIT_DOMAINS || 'https://leaseshieldapp.com'}/settings" class="cta-button">
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
    .message-box { background: #ffffff; border: 2px solid #2563eb; padding: 20px; border-radius: 6px; margin: 20px 0; }
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
}

export const emailService = new EmailService();
