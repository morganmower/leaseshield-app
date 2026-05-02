import Stripe from "stripe";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { randomUUID, randomBytes } from "crypto";
import { storage } from "../storage";
import { RateLimiter } from "../utils/validation";

// Stripe configuration - production uses STRIPE_SECRET_KEY.
// In development only, fall back to TESTING_STRIPE_SECRET_KEY so local
// dev can start without setting a duplicate secret. Production code path
// is unchanged: it reads STRIPE_SECRET_KEY exactly as before.
const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY ||
  (process.env.NODE_ENV !== 'production' ? process.env.TESTING_STRIPE_SECRET_KEY : undefined);

if (!stripeSecretKey) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
});

// Initialize OpenAI for chat assistant
export const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Rate limiter for chat endpoint
export const chatRateLimiter = new RateLimiter(10, 60 * 1000); // 10 messages per minute

// Configure multer for secure file uploads
const uploadStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = 'uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    // Use UUID for collision-resistant filenames
    const uniqueId = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

export const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allowed MIME types for PDF and DOCX
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];

    // Allowed file extensions
    const allowedExtensions = /\.(pdf|docx|doc)$/i;

    const ext = path.extname(file.originalname).toLowerCase();
    const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);
    const extensionValid = allowedExtensions.test(ext);

    if (mimeTypeValid && extensionValid) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  }
});

export const applicantUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    const allowedExtensions = /\.(pdf|jpg|jpeg|png)$/i;

    const ext = path.extname(file.originalname).toLowerCase();
    const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);
    const extensionValid = allowedExtensions.test(ext);

    if (mimeTypeValid && extensionValid) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are allowed'));
    }
  }
});

export function shortToken(length = 10): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  return Array.from(bytes).map((b) => chars[(b as number) % chars.length]).join('');
}

// Helper to get user ID from request with validation
export function getUserId(req: any): string {
  const userId = req.user?.id || req.userId;
  if (!userId) {
    throw new Error('User ID not found in request');
  }
  return userId;
}

// Helper to get client IP address
export function getClientIp(req: any): string {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

// Helper to auto-update submission status based on screening progress
export async function updateSubmissionStatusFromScreening(submissionId: string): Promise<void> {
  try {
    const submission = await storage.getRentalSubmission(submissionId);
    if (!submission) return;

    // Don't modify status if there's already a final decision
    const decision = await storage.getRentalDecision(submissionId);
    if (decision) return;

    const screeningOrders = await storage.getRentalScreeningOrdersBySubmission(submissionId);

    if (screeningOrders.length === 0) {
      // No screening orders yet - don't change status
      return;
    }

    // Normalize order statuses (handle vendor variants like "completed" vs "complete")
    const normalizeStatus = (status: string): string => {
      const s = status.toLowerCase().trim();
      if (s === 'completed' || s === 'complete') return 'complete';
      if (s === 'in_progress' || s === 'in progress' || s === 'inprogress' || s === 'processing') return 'in_progress';
      if (s === 'sent' || s === 'pending') return 'sent';
      return s;
    };

    // Count normalized order statuses
    const normalizedStatuses = screeningOrders.map(o => normalizeStatus(o.status));
    const completeCount = normalizedStatuses.filter(s => s === 'complete').length;
    const inProgressCount = normalizedStatuses.filter(s => s === 'in_progress').length;
    const errorCount = normalizedStatuses.filter(s => s === 'error').length;

    let newStatus: string | null = null;

    // All screening orders are complete (based solely on orders, not people)
    if (completeCount > 0 && completeCount === screeningOrders.length) {
      newStatus = 'complete';
    }
    // Any screening is in progress
    else if (inProgressCount > 0) {
      newStatus = 'in_progress';
    }
    // At least one screening exists and not all are errors
    else if (screeningOrders.length > errorCount) {
      newStatus = 'screening_requested';
    }

    // Update status if changed and not going backwards
    const statusOrder = ['started', 'submitted', 'screening_requested', 'in_progress', 'complete'];
    if (newStatus && statusOrder.indexOf(newStatus) > statusOrder.indexOf(submission.status)) {
      await storage.updateRentalSubmission(submissionId, { status: newStatus });
      console.log(`[Auto-Status] Updated submission ${submissionId} status to ${newStatus}`);
    }
  } catch (error) {
    console.error("Error updating submission status from screening:", error);
  }
}
