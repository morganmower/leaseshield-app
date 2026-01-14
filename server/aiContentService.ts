import OpenAI from "openai";
import { storage } from "./storage";
import type { User, SavedDocument } from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface UserContext {
  firstName: string;
  preferredState: string | null;
  stateFullName: string | null;
  subscriptionStatus: string;
  trialDaysRemaining: number | null;
  propertyCount: number;
  documentDownloadCount: number;
  recentDownloads: string[];
  accountAgeDays: number;
  featuresNotUsed: string[];
}

interface GeneratedEmailContent {
  subject: string;
  htmlBody: string;
  textBody: string;
  isAiGenerated: boolean;
}

const STATE_NAMES: Record<string, string> = {
  UT: "Utah",
  TX: "Texas",
  ND: "North Dakota",
  SD: "South Dakota",
  NC: "North Carolina",
  OH: "Ohio",
  MI: "Michigan",
  ID: "Idaho",
  WY: "Wyoming",
  CA: "California",
  VA: "Virginia",
  NV: "Nevada",
  AZ: "Arizona",
  FL: "Florida",
};

export class AIContentService {
  async getUserContext(userId: string): Promise<UserContext> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      const properties = await storage.getPropertiesByUserId(userId);
      const savedDocs = await storage.getSavedDocumentsByUserId(userId);
      
      const now = new Date();
      const accountAgeDays = user.createdAt 
        ? Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      let trialDaysRemaining: number | null = null;
      if (user.subscriptionStatus === 'trialing' && user.trialEndsAt) {
        trialDaysRemaining = Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const featuresNotUsed: string[] = [];
      if (properties.length === 0) featuresNotUsed.push("Property Management");
      if (savedDocs.length === 0) featuresNotUsed.push("Document Library");

      const recentDownloads = savedDocs
        .sort((a: SavedDocument, b: SavedDocument) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3)
        .map((d: SavedDocument) => d.templateName || "Document");

      return {
        firstName: user.firstName || "there",
        preferredState: user.preferredState || null,
        stateFullName: user.preferredState ? STATE_NAMES[user.preferredState] || user.preferredState : null,
        subscriptionStatus: user.subscriptionStatus || "none",
        trialDaysRemaining,
        propertyCount: properties.length,
        documentDownloadCount: savedDocs.length,
        recentDownloads,
        accountAgeDays,
        featuresNotUsed,
      };
    } catch (error) {
      console.error("Error getting user context:", error);
      return {
        firstName: "there",
        preferredState: null,
        stateFullName: null,
        subscriptionStatus: "none",
        trialDaysRemaining: null,
        propertyCount: 0,
        documentDownloadCount: 0,
        recentDownloads: [],
        accountAgeDays: 0,
        featuresNotUsed: [],
      };
    }
  }

  async generateEmailContent(
    userId: string,
    aiPrompt: string,
    subjectTemplate: string,
    fallbackBody: string
  ): Promise<GeneratedEmailContent> {
    try {
      const context = await this.getUserContext(userId);
      
      const subject = this.replacePlaceholders(subjectTemplate, context);
      
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        console.log("⚠️ OpenAI API key not configured, using fallback content");
        return {
          subject,
          htmlBody: this.wrapInHtmlTemplate(this.replacePlaceholders(fallbackBody, context), subject),
          textBody: this.replacePlaceholders(fallbackBody, context),
          isAiGenerated: false,
        };
      }

      const systemPrompt = `You are an email copywriter for LeaseShield App, a landlord protection platform. 
Write helpful, professional, and warm emails that feel personal but not pushy.
Keep emails concise and focused. Use a friendly tone suitable for busy landlords.
Never use excessive exclamation marks or salesy language.
Format your response as JSON with "body" field containing the email body text (plain text, no HTML).`;

      const userPrompt = `${aiPrompt}

User Context:
- Name: ${context.firstName}
- State: ${context.stateFullName || "Not set"}
- Subscription: ${context.subscriptionStatus}
${context.trialDaysRemaining !== null ? `- Trial Days Remaining: ${context.trialDaysRemaining}` : ""}
- Properties: ${context.propertyCount}
- Documents Downloaded: ${context.documentDownloadCount}
- Account Age: ${context.accountAgeDays} days
${context.featuresNotUsed.length > 0 ? `- Features Not Yet Used: ${context.featuresNotUsed.join(", ")}` : ""}
${context.recentDownloads.length > 0 ? `- Recent Downloads: ${context.recentDownloads.join(", ")}` : ""}

Generate the email body only (no subject, no signature). Keep it under 200 words.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      const parsed = JSON.parse(content);
      const generatedBody = parsed.body || fallbackBody;
      
      const textBody = `Hi ${context.firstName},\n\n${generatedBody}\n\nBest,\nThe LeaseShield Team`;
      const htmlBody = this.wrapInHtmlTemplate(generatedBody, subject, context.firstName);

      console.log(`✅ AI-generated email content for user ${userId}`);
      
      return {
        subject,
        htmlBody,
        textBody,
        isAiGenerated: true,
      };
    } catch (error) {
      console.error("Error generating AI content, using fallback:", error);
      const context = await this.getUserContext(userId);
      const subject = this.replacePlaceholders(subjectTemplate, context);
      const body = this.replacePlaceholders(fallbackBody, context);
      
      return {
        subject,
        htmlBody: this.wrapInHtmlTemplate(body, subject, context.firstName),
        textBody: `Hi ${context.firstName},\n\n${body}\n\nBest,\nThe LeaseShield Team`,
        isAiGenerated: false,
      };
    }
  }

  private replacePlaceholders(template: string, context: UserContext): string {
    return template
      .replace(/\{\{firstName\}\}/g, context.firstName)
      .replace(/\{\{state\}\}/g, context.stateFullName || "your state")
      .replace(/\{\{propertyCount\}\}/g, context.propertyCount.toString())
      .replace(/\{\{trialDays\}\}/g, context.trialDaysRemaining?.toString() || "0")
      .replace(/\{\{subscriptionStatus\}\}/g, context.subscriptionStatus);
  }

  private wrapInHtmlTemplate(bodyText: string, subject: string, firstName: string = "there"): string {
    const paragraphs = bodyText.split("\n\n").map(p => 
      `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, "<br>")}</p>`
    ).join("");

    return `
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
            <td style="background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%); padding: 24px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                LeaseShield App
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e293b;">
                Hi ${firstName},
              </p>
              ${paragraphs}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">
                Best,<br>
                <strong style="color: #334155;">The LeaseShield Team</strong>
              </p>
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #94a3b8;">
                You're receiving this because you're a LeaseShield App user.
                <a href="https://leaseshieldapp.com/settings" style="color: #2dd4bf; text-decoration: none;">Manage email preferences</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async generateWelcomeEmail(userId: string): Promise<GeneratedEmailContent> {
    const aiPrompt = `Write a warm welcome email for a new landlord who just signed up for LeaseShield App.
Briefly mention the key benefits: state-specific legal templates, compliance guidance, and tenant screening tools.
Encourage them to explore based on their situation (whether they have properties set up, their state, etc).
Keep it friendly and helpful, not overwhelming.`;

    const fallback = `Welcome to LeaseShield App! We're excited to help you protect your rental business.

LeaseShield gives you access to state-specific legal templates, compliance guidance, and tenant screening tools designed specifically for landlords like you.

Here's how to get started:
• Set your preferred state to see personalized content
• Browse our template library for lease agreements and notices
• Check out compliance cards to understand your legal requirements

If you have any questions, our support team is here to help.`;

    return this.generateEmailContent(userId, aiPrompt, "Welcome to LeaseShield App, {{firstName}}!", fallback);
  }

  async generateOnboardingTipsEmail(userId: string, dayNumber: number): Promise<GeneratedEmailContent> {
    const context = await this.getUserContext(userId);
    
    let focusArea = "";
    let aiPrompt = "";
    let fallback = "";
    
    if (dayNumber === 3) {
      if (context.propertyCount === 0) {
        focusArea = "adding their first property";
        aiPrompt = `Write a gentle reminder email encouraging the landlord to add their first property to LeaseShield. 
Explain how adding properties helps them keep documents organized and get state-specific recommendations.
Make it feel helpful, not pushy.`;
        fallback = `Did you know you can add your rental properties to LeaseShield? This helps you keep all your documents organized and get recommendations specific to each property's location.

Adding a property takes less than a minute, and it makes finding the right templates much easier.`;
      } else {
        focusArea = "exploring templates";
        aiPrompt = `Write a helpful email about exploring the template library.
The user has properties set up, so encourage them to download relevant templates for their state.
Mention a few popular template types landlords find useful.`;
        fallback = `Now that you have your properties set up, it's a great time to explore our template library.

Popular templates include lease agreements, move-in/move-out checklists, and notice forms. All are customized for your state's legal requirements.`;
      }
    } else if (dayNumber === 5) {
      focusArea = "compliance guidance";
      aiPrompt = `Write an email highlighting the compliance guidance feature.
Explain how compliance cards show before/after examples of meeting state requirements.
Emphasize this helps landlords avoid costly legal mistakes.`;
      fallback = `One of the most valuable features in LeaseShield is our compliance guidance.

Our compliance cards show you exactly what's required in your state, with before/after examples of how to meet each requirement. This helps you avoid costly legal mistakes and stay on the right side of landlord-tenant law.`;
    } else {
      focusArea = "general tips";
      aiPrompt = `Write a helpful tip email for a landlord who's been using the platform for about a week.
Based on their usage, suggest what they might explore next.
Keep it brief and actionable.`;
      fallback = `Just checking in to see how you're doing with LeaseShield!

Remember, we're here to help you stay legally compliant and protect your investment. If you have questions about any feature, don't hesitate to reach out.`;
    }

    return this.generateEmailContent(
      userId, 
      aiPrompt, 
      `Quick tip: ${focusArea.charAt(0).toUpperCase() + focusArea.slice(1)}`, 
      fallback
    );
  }

  async generateReengagementEmail(userId: string): Promise<GeneratedEmailContent> {
    const aiPrompt = `Write a friendly re-engagement email for a landlord who hasn't logged in for a while.
Don't make them feel guilty. Instead, mention something new or valuable they might have missed.
Keep it short and give them one clear reason to come back.`;

    const fallback = `We've missed you at LeaseShield App!

While you've been away, we've been adding new templates and updating our compliance guidance to keep up with the latest legal changes.

Your account is still here, ready whenever you need it. Drop by when you have a moment – there might be something new that's perfect for your situation.`;

    return this.generateEmailContent(userId, aiPrompt, "We've missed you, {{firstName}}", fallback);
  }

  async generateDocumentDownloadConfirmation(
    userId: string, 
    templateTitle: string
  ): Promise<GeneratedEmailContent> {
    const aiPrompt = `Write a brief confirmation email for a landlord who just downloaded a document template called "${templateTitle}".
Include a tip about using the document effectively.
Mention they can find their saved documents anytime in their account.
Keep it very brief - this is a transactional email.`;

    const fallback = `Your document "${templateTitle}" is ready!

You can access this document anytime from your Saved Documents in LeaseShield. If you need to make changes or download a fresh copy, it's just a click away.

Tip: Review the document carefully and customize it for your specific situation before use.`;

    return this.generateEmailContent(
      userId, 
      aiPrompt, 
      `Your document is ready: ${templateTitle}`, 
      fallback
    );
  }
}

export const aiContentService = new AIContentService();
