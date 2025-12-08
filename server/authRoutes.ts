import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db';
import { users, refreshTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  generateAccessToken,
  generateRefreshToken,
  generateRefreshTokenHash,
  verifyRefreshToken,
  getRefreshTokenExpiry,
  extractTokenFromHeader,
  verifyAccessToken,
  TokenPayload,
} from './jwt';

const router = Router();

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { email, password, firstName, lastName } = parsed.data;

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    const [newUser] = await db.insert(users).values({
      email,
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      subscriptionStatus: 'trialing',
      trialEndsAt,
    }).returning();

    const tokenPayload: TokenPayload = {
      userId: newUser.id,
      email: newUser.email,
      isAdmin: newUser.isAdmin ?? false,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshTokenValue = generateRefreshTokenHash();

    await db.insert(refreshTokens).values({
      userId: newUser.id,
      token: refreshTokenValue,
      expiresAt: getRefreshTokenExpiry(),
    });

    res.cookie('refreshToken', refreshTokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.status(201).json({
      message: 'Account created successfully',
      accessToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        isAdmin: newUser.isAdmin,
        subscriptionStatus: newUser.subscriptionStatus,
        trialEndsAt: newUser.trialEndsAt,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Failed to create account' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { email, password } = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ message: 'Please set up your password using the forgot password link' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin ?? false,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshTokenValue = generateRefreshTokenHash();

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));

    await db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshTokenValue,
      expiresAt: getRefreshTokenExpiry(),
    });

    res.cookie('refreshToken', refreshTokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        preferredState: user.preferredState,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        stripeCustomerId: user.stripeCustomerId,
        businessName: user.businessName,
        phoneNumber: user.phoneNumber,
        notifyLegalUpdates: user.notifyLegalUpdates,
        notifyTemplateRevisions: user.notifyTemplateRevisions,
        notifyBillingAlerts: user.notifyBillingAlerts,
        notifyTips: user.notifyTips,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const refreshTokenValue = req.cookies?.refreshToken;
    
    if (refreshTokenValue) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshTokenValue));
    }

    res.clearCookie('refreshToken', { path: '/' });
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Logout failed' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshTokenValue = req.cookies?.refreshToken;
    
    if (!refreshTokenValue) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, refreshTokenValue))
      .limit(1);

    if (!storedToken) {
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    if (new Date() > storedToken.expiresAt) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshTokenValue));
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, storedToken.userId)).limit(1);
    if (!user) {
      await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshTokenValue));
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({ message: 'User not found' });
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin ?? false,
    };

    const accessToken = generateAccessToken(tokenPayload);

    const newRefreshTokenValue = generateRefreshTokenHash();
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshTokenValue));
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: newRefreshTokenValue,
      expiresAt: getRefreshTokenExpiry(),
    });

    res.cookie('refreshToken', newRefreshTokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        preferredState: user.preferredState,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        stripeCustomerId: user.stripeCustomerId,
        businessName: user.businessName,
        phoneNumber: user.phoneNumber,
        notifyLegalUpdates: user.notifyLegalUpdates,
        notifyTemplateRevisions: user.notifyTemplateRevisions,
        notifyBillingAlerts: user.notifyBillingAlerts,
        notifyTips: user.notifyTips,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ message: 'Failed to refresh token' });
  }
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ message: 'No access token provided' });
    }

    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin,
      preferredState: user.preferredState,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt,
      subscriptionEndsAt: user.subscriptionEndsAt,
      stripeCustomerId: user.stripeCustomerId,
      businessName: user.businessName,
      phoneNumber: user.phoneNumber,
      notifyLegalUpdates: user.notifyLegalUpdates,
      notifyTemplateRevisions: user.notifyTemplateRevisions,
      notifyBillingAlerts: user.notifyBillingAlerts,
      notifyTips: user.notifyTips,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ message: 'Failed to get user info' });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { email } = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1);

    await db.update(users).set({
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    }).where(eq(users.id, user.id));

    console.log(`Password reset token for ${email}: ${resetToken}`);

    return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Failed to process password reset request' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { token, password } = parsed.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetToken, token))
      .limit(1);

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    if (!user.passwordResetExpires || new Date() > user.passwordResetExpires) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.update(users).set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    }).where(eq(users.id, user.id));

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Failed to reset password' });
  }
});

export default router;
