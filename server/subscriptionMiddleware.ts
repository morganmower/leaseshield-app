import { storage } from "./storage";

// Admin-only middleware - checks if user has isAdmin flag
export async function requireAdmin(req: any, res: any, next: any) {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!user.isAdmin) {
      console.log(`[Admin] DENIED for user ${userId}: isAdmin=false`);
      return res.status(403).json({ message: "Admin access required" });
    }

    console.log(`[Admin] User ${userId}: isAdmin=true, allowing access`);
    return next();
  } catch (error) {
    console.error("Error in admin middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function requireActiveSubscription(req: any, res: any, next: any) {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const now = new Date();
    
    // Users in trial mode can access everything (including incomplete status with trial)
    if (user.subscriptionStatus === 'trialing' || user.subscriptionStatus === 'incomplete') {
      if (user.trialEndsAt) {
        const trialEndsDate = new Date(user.trialEndsAt);
        console.log(`[Subscription] User ${userId}: status=${user.subscriptionStatus}, trialEndsAt=${user.trialEndsAt}, trialEndsDate=${trialEndsDate.toISOString()}, now=${now.toISOString()}, isValid=${trialEndsDate > now}`);
        if (trialEndsDate > now) {
          return next();
        }
      } else {
        console.log(`[Subscription] User ${userId}: status=${user.subscriptionStatus}, but NO trialEndsAt set!`);
      }
    }

    // Users with active subscriptions have access
    if (user.subscriptionStatus === 'active') {
      console.log(`[Subscription] User ${userId}: status=active, checking subscription end date`);
      if (user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now) {
        return next();
      }
      // Active status without end date = lifetime/valid subscription
      if (!user.subscriptionEndsAt) {
        return next();
      }
    }

    // Admin users always have access
    if (user.isAdmin) {
      console.log(`[Subscription] User ${userId}: isAdmin=true, allowing access`);
      return next();
    }

    // Access denied - trial expired and no active subscription
    console.log(`[Subscription] DENIED for user ${userId}: status=${user.subscriptionStatus}, trialEndsAt=${user.trialEndsAt}`);
    return res.status(403).json({ 
      message: "Your trial has ended. Please subscribe to continue using LeaseShield App.",
      requiresSubscription: true
    });
  } catch (error) {
    console.error("Error in subscription middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
