import type { LegalUpdate, State } from "@shared/schema";

interface LegalUpdateEmailData {
  update: LegalUpdate & {
    whatChanged?: string | null;
    nextSteps?: string | null;
  };
  state: State & { code: string };
  userEmail: string;
  userName?: string;
}

export function generateLegalUpdateEmail(data: LegalUpdateEmailData) {
  const { update, state, userName } = data;
  
  const impactColors: Record<string, string> = {
    high: '#ef4444',
    medium: '#f97316', 
    low: '#3b82f6'
  };
  
  const impactLabels: Record<string, string> = {
    high: 'HIGH IMPACT',
    medium: 'MEDIUM IMPACT',
    low: 'LOW IMPACT'
  };
  
  const color = impactColors[update.impactLevel] || '#3b82f6';
  const label = impactLabels[update.impactLevel] || 'UPDATE';
  
  const subject = `[${label}] Legal Update: ${update.title} - ${state.code}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                🛡️ LeaseShield App
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; font-size: 14px;">
                Legal Update Alert
              </p>
            </td>
          </tr>
          
          <!-- Impact Badge -->
          <tr>
            <td style="padding: 24px 40px 0 40px; text-align: center;">
              <span style="display: inline-block; padding: 6px 16px; background-color: ${color}; color: #ffffff; font-size: 12px; font-weight: 600; border-radius: 4px; letter-spacing: 0.5px;">
                ${label}
              </span>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 40px 16px 40px;">
              <p style="margin: 0; color: #0f172a; font-size: 16px;">
                Hi ${userName || 'there'},
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 600;">
                ${update.title}
              </h2>
              
              <div style="background-color: #f1f5f9; border-left: 4px solid ${color}; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  <strong>State:</strong> ${state.name} (${state.code})<br>
                  <strong>Effective Date:</strong> ${update.effectiveDate ? new Date(update.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}
                </p>
              </div>
              
              <div style="margin-bottom: 24px;">
                <p style="margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.6;">
                  ${update.summary}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- What Changed Section -->
          ${update.whatChanged ? `
          <tr>
            <td style="padding: 0 40px;">
              <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                What Changed:
              </h3>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                ${update.whatChanged}
              </p>
            </td>
          </tr>
          ` : ''}
          
          <!-- Why It Matters Section -->
          ${update.whyItMatters ? `
          <tr>
            <td style="padding: 0 40px;">
              <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                Why It Matters to You:
              </h3>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                ${update.whyItMatters}
              </p>
            </td>
          </tr>
          ` : ''}
          
          <!-- Next Steps Section -->
          ${update.nextSteps ? `
          <tr>
            <td style="padding: 0 40px;">
              <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                Recommended Next Steps:
              </h3>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                ${update.nextSteps}
              </p>
            </td>
          </tr>
          ` : ''}
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 32px 40px; text-align: center;">
              <a href="${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/compliance` : 'https://leaseshieldapp.com/compliance'}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">
                View Updated Templates
              </a>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #e2e8f0; margin: 0 0 24px 0;"></div>
            </td>
          </tr>
          
          <!-- Disclaimer -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                <strong>Legal Disclaimer:</strong> This email provides general legal information for educational purposes only and does not constitute legal advice. LeaseShield App is not a law firm and does not provide legal representation. For specific legal advice, please consult a licensed attorney in your state.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">
                LeaseShield App - Your Protective Mentor for Rental Property Management
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                Questions? Email us at <a href="mailto:support@leaseshieldapp.com" style="color: #2563eb; text-decoration: none;">support@leaseshieldapp.com</a>
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
LeaseShield App - Legal Update Alert

${label}: ${update.title}

Hi ${userName || 'there'},

A new legal change affects landlords in ${state.name} (${state.code}).

Effective Date: ${update.effectiveDate ? new Date(update.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}

${update.summary}

${update.whatChanged ? `What Changed:\n${update.whatChanged}\n\n` : ''}
${update.whyItMatters ? `Why It Matters:\n${update.whyItMatters}\n\n` : ''}
${update.nextSteps ? `Next Steps:\n${update.nextSteps}\n\n` : ''}

View your updated templates: ${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/compliance` : 'https://leaseshieldapp.com/compliance'}

---
Legal Disclaimer: This email provides general legal information for educational purposes only and does not constitute legal advice. LeaseShield App is not a law firm and does not provide legal representation.

LeaseShield App
support@leaseshieldapp.com
  `;
  
  return { subject, html, text };
}

export function generateMonthlyDigestEmail(updates: Array<{update: LegalUpdate & {whatChanged?: string | null; nextSteps?: string | null}; state: State & {code: string}}>, userEmail: string, userName?: string) {
  const subject = 'LeaseShield Monthly Legal Updates Digest';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                🛡️ LeaseShield App
              </h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; font-size: 14px;">
                Monthly Legal Updates Digest
              </p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 24px 40px;">
              <p style="margin: 0; color: #0f172a; font-size: 16px;">
                Hi ${userName || 'there'},
              </p>
              <p style="margin: 16px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">
                Here's a summary of ${updates.length} legal update${updates.length !== 1 ? 's' : ''} from this month that may affect your rental properties.
              </p>
            </td>
          </tr>
          
          <!-- Updates List -->
          ${updates.map(({update, state}) => `
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; background-color: #f8fafc;">
                <div style="margin-bottom: 12px;">
                  <span style="display: inline-block; padding: 4px 12px; background-color: ${update.impactLevel === 'high' ? '#ef4444' : update.impactLevel === 'medium' ? '#f97316' : '#3b82f6'}; color: #ffffff; font-size: 11px; font-weight: 600; border-radius: 3px; margin-right: 8px;">
                    ${update.impactLevel.toUpperCase()}
                  </span>
                  <span style="color: #64748b; font-size: 13px;">${state.code}</span>
                </div>
                <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                  ${update.title}
                </h3>
                <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  ${update.summary}
                </p>
                <p style="margin: 12px 0 0 0; color: #64748b; font-size: 13px;">
                  Effective: ${update.effectiveDate ? new Date(update.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}
                </p>
              </div>
            </td>
          </tr>
          `).join('')}
          
          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 32px 40px; text-align: center;">
              <a href="${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/compliance` : 'https://leaseshieldapp.com/compliance'}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">
                Review All Updates
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">
                LeaseShield App
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                <a href="mailto:support@leaseshieldapp.com" style="color: #2563eb; text-decoration: none;">support@leaseshieldapp.com</a>
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
LeaseShield App - Monthly Legal Updates Digest

Hi ${userName || 'there'},

Here's a summary of ${updates.length} legal update${updates.length !== 1 ? 's' : ''} from this month:

${updates.map(({update, state}) => `
[${update.impactLevel.toUpperCase()}] ${state.code} - ${update.title}
${update.summary}
Effective: ${update.effectiveDate ? new Date(update.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'}
`).join('\n---\n')}

Review all updates: ${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/compliance` : 'https://leaseshieldapp.com/compliance'}

LeaseShield App
support@leaseshieldapp.com
  `;
  
  return { subject, html, text };
}
