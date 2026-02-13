import type { RequestHandler, Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from './jwt';
import { storage } from './storage';

export const isAuthenticated: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  console.error(`🔒 [JWT Auth] ${req.method} ${req.path} - checking auth...`);
  
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (!token) {
    console.error(`🔒 [JWT Auth] ❌ No access token provided`);
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    console.error(`🔒 [JWT Auth] ❌ Invalid or expired token`);
    return res.status(401).json({ message: 'Token expired or invalid' });
  }

  try {
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      console.error(`🔒 [JWT Auth] ❌ User not found: ${decoded.userId}`);
      return res.status(401).json({ message: 'User not found' });
    }

    (req as any).user = user;
    (req as any).userId = user.id;
    console.error(`🔒 [JWT Auth] ✅ Authenticated: ${user.email}`);
    next();
  } catch (error) {
    console.error(`🔒 [JWT Auth] ❌ Database error:`, error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

export const requireAccess: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (user.isAdmin) {
    return next();
  }

  const hasActiveSubscription = 
    user.subscriptionStatus === 'active' || 
    user.subscriptionStatus === 'cancel_at_period_end' ||
    user.subscriptionStatus === 'trialing';

  if (!hasActiveSubscription) {
    return res.status(403).json({ 
      message: 'Subscription required',
      requiresSubscription: true 
    });
  }

  if (user.subscriptionStatus === 'trialing' && user.trialEndsAt) {
    const trialEndsDate = new Date(user.trialEndsAt);
    if (new Date() > trialEndsDate) {
      return res.status(403).json({ 
        message: 'Trial expired',
        requiresSubscription: true 
      });
    }
  }

  next();
};

export const requireAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};
