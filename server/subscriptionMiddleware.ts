import { storage } from "./storage";

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

    // Admins always have access
    if (user.isAdmin) {
      return next();
    }

    // Users in trial mode can access everything (including incomplete status with trial)
    if (user.subscriptionStatus === 'trialing' || user.subscriptionStatus === 'incomplete') {
      const now = new Date();
      if (user.trialEndsAt && user.trialEndsAt > now) {
        return next();
      }
    }

    // Users with active subscriptions have access
    if (user.subscriptionStatus === 'active') {
      if (user.subscriptionEndsAt && user.subscriptionEndsAt > new Date()) {
        return next();
      }
    }

    // Access denied - trial expired and no active subscription
    return res.status(403).json({ 
      message: "Your trial has ended. Please subscribe to continue using LeaseShield App.",
      requiresSubscription: true
    });
  } catch (error) {
    console.error("Error in subscription middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
