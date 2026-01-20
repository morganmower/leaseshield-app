import Stripe from 'stripe';
import { db } from '../db';
import { users } from '@shared/schema';
import { isNotNull, eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
});

async function backfillCurrentPeriodEnd() {
  console.log('Starting backfill of current_period_end...');
  
  const usersWithSubscriptions = await db
    .select()
    .from(users)
    .where(isNotNull(users.stripeSubscriptionId));
  
  console.log(`Found ${usersWithSubscriptions.length} users with subscriptions`);
  
  for (const user of usersWithSubscriptions) {
    if (!user.stripeSubscriptionId) continue;
    
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      
      await db
        .update(users)
        .set({ currentPeriodEnd })
        .where(eq(users.id, user.id));
      
      console.log(`Updated ${user.email}: next renewal ${currentPeriodEnd.toISOString()}`);
    } catch (error: any) {
      console.error(`Failed for ${user.email}: ${error.message}`);
    }
  }
  
  console.log('Backfill complete!');
}

backfillCurrentPeriodEnd().catch(console.error);
