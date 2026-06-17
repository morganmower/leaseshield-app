import type { Express } from "express";
import { users } from "@shared/schema";
import { asyncHandler } from "../utils/validation";
import { openai, chatRateLimiter, getClientIp } from "./_shared";

export async function registerChatRoutes(app: Express) {
  // Chat assistant endpoint (public, for landing page)
  app.post('/api/chat', asyncHandler(async (req, res) => {
    // Rate limiting
    const clientIp = getClientIp(req);
    if (!chatRateLimiter.check(clientIp)) {
      return res.status(429).json({
        reply: "You're sending messages too quickly. Please wait a moment and try again."
      });
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ reply: "Please provide a valid message." });
    }

    if (message.length > 500) {
      return res.status(400).json({ reply: "Message is too long. Please keep it under 500 characters." });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are the LeaseShield Assistant, a helpful and protective AI assistant for landlords visiting the LeaseShield App website.

ABOUT LEASESHIELD APP:
- Subscription-based platform ($12/month with 7-day free trial)
- Provides state-specific legal templates, compliance guidance, and tenant screening resources
- Currently serving: Utah (UT), Texas (TX), North Dakota (ND), South Dakota (SD), and North Carolina (NC)
- Features: professional state-specific lease agreements, compliance cards, legal update notifications, screening guides, tenant issue workflows
- Tone: "Protective mentor" - helping landlords protect their investments while staying compliant

YOUR ROLE:
1. Answer questions about landlord-tenant law in UT, TX, ND, SD, and NC (general guidance only, not legal advice)
2. Explain LeaseShield App features and benefits
3. Help landlords understand compliance requirements
4. Guide them toward signing up for the 7-day free trial
5. Be warm, professional, and protective of their interests

IMPORTANT DISCLAIMERS:
- Always remind users that you provide educational information, not legal advice
- Encourage them to consult an attorney for specific legal situations
- Emphasize that LeaseShield App provides templates and guidance, but users should review with legal counsel

TONE: Friendly, knowledgeable, protective, and helpful. Think "experienced landlord mentor."

If asked about states we don't serve, politely explain we currently focus on UT, TX, ND, SD, and NC but are expanding.

Keep responses concise (2-4 sentences unless more detail is specifically requested).`
        },
        {
          role: "user",
          content: message
        }
      ],
      max_completion_tokens: 800,
    });

    const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again.";

    res.json({ reply });
  }));
}
