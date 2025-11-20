import { storage } from './storage';
import { getUncachableResendClient } from './resend';
import type { Template, TemplateVersion } from '@shared/schema';

export async function notifyUsersOfTemplateUpdate(
  template: Template,
  version: TemplateVersion
): Promise<number> {
  try {
    console.log(`📧 Notifying users about template update: ${template.title} v${version.versionNumber}`);

    // Get all users in this template's state
    const usersToNotify = await storage.getUsersByState(template.stateId);
    
    console.log(`  Found ${usersToNotify.length} users to notify in ${template.stateId}`);

    if (usersToNotify.length === 0) {
      return 0;
    }

    // Create in-app notifications for all users
    for (const user of usersToNotify) {
      await storage.createUserNotification({
        userId: user.id,
        message: `${template.title} has been updated to version ${version.versionNumber}`,
        isRead: false,
      });
    }

    // Send batch emails
    await sendTemplateUpdateEmails(usersToNotify, template, version);

    console.log(`✅ Template update notifications sent to ${usersToNotify.length} users`);
    return usersToNotify.length;
    
  } catch (error) {
    console.error('Error notifying users of template update:', error);
    return 0;
  }
}

async function sendTemplateUpdateEmails(
  users: any[],
  template: Template,
  version: TemplateVersion
): Promise<void> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    for (const user of users) {
      if (!user.email) continue;

      const html = generateTemplateUpdateEmail(user, template, version);
      const text = generateTemplateUpdateTextEmail(user, template, version);

      await client.emails.send({
        from: fromEmail,
        to: user.email,
        subject: `Important: ${getStateName(template.stateId)} Template Updated - ${template.title} v${version.versionNumber}`,
        html,
        text,
      });

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('Error sending template update emails:', error);
  }
}

function generateTemplateUpdateEmail(
  user: any,
  template: Template,
  version: TemplateVersion
): string {
  const userName = user.firstName || 'there';
  const stateFullName = getStateName(template.stateId);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Update Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 32px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                LeaseShield App
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; font-size: 14px;">
                Template Update Notification
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 600;">
                Hi ${userName},
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                An important template has been updated to comply with recent legislative changes in ${stateFullName}:
              </p>

              <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 600;">
                  ${template.title}
                </h3>
                <p style="margin: 0; color: #64748b; font-size: 14px;">
                  <strong>Version:</strong> ${version.versionNumber}.0
                </p>
              </div>

              <div style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                  What Changed:
                </h4>
                <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  ${version.versionNotes || 'Updated for legal compliance'}
                </p>

                ${version.lastUpdateReason ? `
                <h4 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                  Why It Changed:
                </h4>
                <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  ${version.lastUpdateReason}
                </p>
                ` : ''}
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${process.env.REPLIT_DOMAINS?.split(',')[0] || 'https://leaseshieldapp.com'}/templates" 
                   style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                  Download Updated Template
                </a>
              </div>

              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0 0 16px 0; color: #ef4444; font-size: 14px; font-weight: 600;">
                  Important Notice:
                </p>
                <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                  Please review the updated template carefully. If you have active leases or documents using the previous version, 
                  we recommend consulting with an attorney to determine if any updates to existing agreements are necessary.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 13px;">
                This notification is part of your LeaseShield App subscription
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
}

function generateTemplateUpdateTextEmail(
  user: any,
  template: Template,
  version: TemplateVersion
): string {
  const userName = user.firstName || 'there';
  const stateFullName = getStateName(template.stateId);

  return `
LeaseShield App - Template Update Notification

Hi ${userName},

An important template has been updated to comply with recent legislative changes in ${stateFullName}:

TEMPLATE: ${template.title}
VERSION: ${version.versionNumber}.0

WHAT CHANGED:
${version.versionNotes || 'Updated for legal compliance'}

${version.lastUpdateReason ? `WHY IT CHANGED:\n${version.lastUpdateReason}\n` : ''}

Download the updated template at: ${process.env.REPLIT_DOMAINS?.split(',')[0] || 'https://leaseshieldapp.com'}/templates

IMPORTANT NOTICE:
Please review the updated template carefully. If you have active leases or documents using the previous version, 
we recommend consulting with an attorney to determine if any updates to existing agreements are necessary.

This notification is part of your LeaseShield App subscription.
  `;
}

function getStateName(code: string): string {
  const names: Record<string, string> = {
    'UT': 'Utah',
    'TX': 'Texas',
    'ND': 'North Dakota',
    'SD': 'South Dakota',
  };
  return names[code] || code;
}
