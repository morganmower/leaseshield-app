import type { RequestHandler, Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader } from './jwt';
import { storage } from './storage';

// In-memory impersonation storage: adminId -> { impersonatedUserId, startedAt }
const impersonationSessions = new Map<string, { impersonatedUserId: string; startedAt: Date }>();

export function startImpersonation(adminId: string, targetUserId: string): void {
  impersonationSessions.set(adminId, { impersonatedUserId: targetUserId, startedAt: new Date() });
}

export function stopImpersonation(adminId: string): void {
  impersonationSessions.delete(adminId);
}

export function getImpersonationStatus(adminId: string): { impersonatedUserId: string; startedAt: Date } | null {
  return impersonationSessions.get(adminId) || null;
}

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
    const authenticatedUser = await storage.getUser(decoded.userId);
    if (!authenticatedUser) {
      console.error(`🔒 [JWT Auth] ❌ User not found: ${decoded.userId}`);
      return res.status(401).json({ message: 'User not found' });
    }

    // Check for impersonation (only admins can impersonate)
    const impersonation = authenticatedUser.isAdmin ? impersonationSessions.get(authenticatedUser.id) : null;
    
    if (impersonation) {
      const impersonatedUser = await storage.getUser(impersonation.impersonatedUserId);
      if (impersonatedUser) {
        // Use impersonated user's context
        (req as any).user = impersonatedUser;
        (req as any).userId = impersonatedUser.id;
        (req as any).isImpersonating = true;
        (req as any).realAdmin = authenticatedUser;
        console.error(`🔒 [JWT Auth] ✅ Admin ${authenticatedUser.email} impersonating: ${impersonatedUser.email}`);
        return next();
      }
    }

    (req as any).user = authenticatedUser;
    (req as any).userId = authenticatedUser.id;
    (req as any).isImpersonating = false;
    console.error(`🔒 [JWT Auth] ✅ Authenticated: ${authenticatedUser.email}`);
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
