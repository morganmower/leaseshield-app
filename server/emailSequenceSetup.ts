import { storage } from './storage';

export async function setupEmailSequences(): Promise<void> {
  console.log('🚀 Setting up email sequences...');

  try {
    const existingSequences = await storage.getEmailSequences();
    
    // Check for existing sequences and backfill any missing ones
    const existingTriggers = new Set(existingSequences.map(s => s.trigger));
    
    if (existingSequences.length > 0) {
      console.log(`  ✓ Email sequences already exist (${existingSequences.length} sequences)`);
      
      // Backfill trial expiration sequence if missing
      if (!existingTriggers.has('trial_expiring')) {
        console.log('  → Backfilling missing trial_expiring sequence...');
        await createTrialExpirationSequence();
      }
      
      return;
    }

    const welcomeSequence = await storage.createEmailSequence({
      name: 'Welcome Series',
      description: 'Automated welcome emails for new users during their trial period',
      trigger: 'signup',
      isActive: true,
    });
    console.log(`  ✓ Created Welcome Series sequence`);

    await storage.createEmailSequenceStep({
      sequenceId: welcomeSequence.id,
      stepNumber: 1,
      name: 'Welcome Email',
      subject: 'Welcome to LeaseShield App, {{firstName}}!',
      aiPrompt: `Write a warm welcome email for a new landlord who just signed up for LeaseShield App.
Briefly mention the key benefits: state-specific legal templates, compliance guidance, and tenant screening tools.
Encourage them to explore based on their situation (whether they have properties set up, their state, etc).
Keep it friendly and helpful, not overwhelming.`,
      fallbackBody: `Welcome to LeaseShield App! We're excited to help you protect your rental business.

LeaseShield gives you access to state-specific legal templates, compliance guidance, and tenant screening tools designed specifically for landlords like you.

Here's how to get started:
• Set your preferred state to see personalized content
• Browse our template library for lease agreements and notices
• Check out compliance cards to understand your legal requirements

If you have any questions, our support team is here to help.`,
      delayHours: 0,
      isActive: true,
    });
    console.log(`    → Added Step 1: Welcome Email (immediate)`);

    await storage.createEmailSequenceStep({
      sequenceId: welcomeSequence.id,
      stepNumber: 2,
      name: 'Day 3 Tips - Getting Started',
      subject: 'Quick tip: Getting the most from LeaseShield',
      aiPrompt: `Write a helpful tip email for day 3 of the user's trial.
If they haven't added properties, encourage them to do so.
If they have properties, suggest exploring templates.
Keep it brief and actionable with one clear next step.`,
      fallbackBody: `Just checking in to see how you're settling in with LeaseShield!

Here's a quick tip: Adding your properties helps you stay organized and get recommendations specific to each location.

It takes less than a minute, and it makes finding the right templates much easier.`,
      delayHours: 72,
      isActive: true,
    });
    console.log(`    → Added Step 2: Day 3 Tips (72 hours)`);

    await storage.createEmailSequenceStep({
      sequenceId: welcomeSequence.id,
      stepNumber: 3,
      name: 'Day 5 Tips - Compliance',
      subject: 'Stay compliant with {{state}} landlord-tenant laws',
      aiPrompt: `Write an email highlighting the compliance guidance feature.
Explain how compliance cards show before/after examples of meeting state requirements.
Emphasize this helps landlords avoid costly legal mistakes.
Reference their specific state if available.`,
      fallbackBody: `One of the most valuable features in LeaseShield is our compliance guidance.

Our compliance cards show you exactly what's required in your state, with before/after examples of how to meet each requirement.

This helps you avoid costly legal mistakes and stay on the right side of landlord-tenant law.`,
      delayHours: 120,
      isActive: true,
    });
    console.log(`    → Added Step 3: Day 5 Compliance Tips (120 hours)`);

    const reengagementSequence = await storage.createEmailSequence({
      name: 'Re-engagement',
      description: 'Re-engage users who have been inactive for a while',
      trigger: 'inactive',
      isActive: true,
    });
    console.log(`  ✓ Created Re-engagement sequence`);

    await storage.createEmailSequenceStep({
      sequenceId: reengagementSequence.id,
      stepNumber: 1,
      name: 'We Miss You',
      subject: "We've missed you, {{firstName}}",
      aiPrompt: `Write a friendly re-engagement email for a landlord who hasn't logged in for a while.
Don't make them feel guilty. Instead, mention something new or valuable they might have missed.
Keep it short and give them one clear reason to come back.`,
      fallbackBody: `We've missed you at LeaseShield App!

While you've been away, we've been adding new templates and updating our compliance guidance to keep up with the latest legal changes.

Your account is still here, ready whenever you need it. Drop by when you have a moment – there might be something new that's perfect for your situation.`,
      delayHours: 0,
      isActive: true,
    });
    console.log(`    → Added Step 1: We Miss You (immediate)`);

    const subscriptionSequence = await storage.createEmailSequence({
      name: 'Subscription Confirmation',
      description: 'Confirmation and onboarding after subscription',
      trigger: 'subscription',
      isActive: true,
    });
    console.log(`  ✓ Created Subscription Confirmation sequence`);

    await storage.createEmailSequenceStep({
      sequenceId: subscriptionSequence.id,
      stepNumber: 1,
      name: 'Subscription Confirmed',
      subject: 'Welcome to the LeaseShield family, {{firstName}}!',
      aiPrompt: `Write a warm confirmation email for a landlord who just subscribed.
Thank them for their trust and commitment.
Highlight what they now have full access to.
Suggest one or two things they should explore first based on their usage.`,
      fallbackBody: `Thank you for subscribing to LeaseShield App!

You now have full access to all our features:
• State-specific legal templates and notices
• Compliance guidance with before/after examples
• AI-powered screening helpers
• Tenant issue workflows
• And much more!

If you ever have questions, our support team is here to help.`,
      delayHours: 0,
      isActive: true,
    });
    console.log(`    → Added Step 1: Subscription Confirmed (immediate)`);

    // Trial Expiration Sequence
    const trialExpirationSequence = await storage.createEmailSequence({
      name: 'Trial Expiration',
      description: 'Remind users before their trial expires to encourage conversion',
      trigger: 'trial_expiring',
      isActive: true,
    });
    console.log(`  ✓ Created Trial Expiration sequence`);

    await storage.createEmailSequenceStep({
      sequenceId: trialExpirationSequence.id,
      stepNumber: 1,
      name: '3 Days Before Expiration',
      subject: 'Your LeaseShield trial ends in 3 days',
      aiPrompt: `Write a friendly reminder email that the user's trial expires in 3 days.
Highlight what they've accomplished so far (documents created, templates used, etc).
Emphasize what they'll lose access to if they don't subscribe.
Mention the affordable price ($10/month or $100/year).
Create urgency without being pushy.
Include a clear call-to-action to subscribe.`,
      fallbackBody: `Your LeaseShield trial ends in just 3 days!

We hope you've been enjoying access to our state-specific legal templates, compliance guidance, and landlord tools.

When your trial ends, you'll lose access to:
• All legal document templates and notices
• Compliance guidance for your state
• AI-powered screening helpers
• Saved documents and properties

The good news? You can keep everything for just $10/month (or save with our $100/year plan).

Don't let your hard work disappear – subscribe today and keep protecting your rental business.`,
      delayHours: 0,
      isActive: true,
    });
    console.log(`    → Added Step 1: 3 Days Before Expiration`);

    await storage.createEmailSequenceStep({
      sequenceId: trialExpirationSequence.id,
      stepNumber: 2,
      name: '1 Day Before Expiration',
      subject: 'Last chance: Your trial expires tomorrow',
      aiPrompt: `Write an urgent but friendly final reminder that the trial expires tomorrow.
This is their last chance email.
Personalize based on their usage - what documents they've created, what state they're in.
Emphasize the value they've gotten and what they'll lose.
Make the subscription CTA very prominent.
Keep it short and action-focused.`,
      fallbackBody: `This is your last chance – your LeaseShield trial expires tomorrow!

After tomorrow, you'll lose access to all your saved documents, templates, and compliance tools.

Subscribe now for just $10/month to keep everything you've built and continue protecting your rental business with state-specific legal guidance.

Don't wait – subscribe today before your trial ends.`,
      delayHours: 48,
      isActive: true,
    });
    console.log(`    → Added Step 2: 1 Day Before Expiration (48 hours after step 1)`);

    console.log('✅ Email sequences setup complete!');
  } catch (error) {
    console.error('❌ Error setting up email sequences:', error);
  }
}

// Helper function to create trial expiration sequence (used for backfilling)
async function createTrialExpirationSequence(): Promise<void> {
  const trialExpirationSequence = await storage.createEmailSequence({
    name: 'Trial Expiration',
    description: 'Remind users before their trial expires to encourage conversion',
    trigger: 'trial_expiring',
    isActive: true,
  });
  console.log(`  ✓ Created Trial Expiration sequence`);

  await storage.createEmailSequenceStep({
    sequenceId: trialExpirationSequence.id,
    stepNumber: 1,
    name: '3 Days Before Expiration',
    subject: 'Your LeaseShield trial ends in 3 days',
    aiPrompt: `Write a friendly reminder email that the user's trial expires in 3 days.
Highlight what they've accomplished so far (documents created, templates used, etc).
Emphasize what they'll lose access to if they don't subscribe.
Mention the affordable price ($10/month or $100/year).
Create urgency without being pushy.
Include a clear call-to-action to subscribe.`,
    fallbackBody: `Your LeaseShield trial ends in just 3 days!

We hope you've been enjoying access to our state-specific legal templates, compliance guidance, and landlord tools.

When your trial ends, you'll lose access to:
• All legal document templates and notices
• Compliance guidance for your state
• AI-powered screening helpers
• Saved documents and properties

The good news? You can keep everything for just $10/month (or save with our $100/year plan).

Don't let your hard work disappear – subscribe today and keep protecting your rental business.`,
    delayHours: 0,
    isActive: true,
  });
  console.log(`    → Added Step 1: 3 Days Before Expiration`);

  await storage.createEmailSequenceStep({
    sequenceId: trialExpirationSequence.id,
    stepNumber: 2,
    name: '1 Day Before Expiration',
    subject: 'Last chance: Your trial expires tomorrow',
    aiPrompt: `Write an urgent but friendly final reminder that the trial expires tomorrow.
This is their last chance email.
Personalize based on their usage - what documents they've created, what state they're in.
Emphasize the value they've gotten and what they'll lose.
Make the subscription CTA very prominent.
Keep it short and action-focused.`,
    fallbackBody: `This is your last chance – your LeaseShield trial expires tomorrow!

After tomorrow, you'll lose access to all your saved documents, templates, and compliance tools.

Subscribe now for just $10/month to keep everything you've built and continue protecting your rental business with state-specific legal guidance.

Don't wait – subscribe today before your trial ends.`,
    delayHours: 48,
    isActive: true,
  });
  console.log(`    → Added Step 2: 1 Day Before Expiration (48 hours after step 1)`);
}
