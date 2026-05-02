import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../jwtAuth";
import { screeningFeedback, insertScreeningFeedbackSchema } from "@shared/schema";
import { db } from "../db";
import { asyncHandler } from "../utils/validation";

export async function registerScreeningFeedbackRoutes(app: Express) {
  // Screening decoder feedback endpoint - for learning system
  app.post('/api/screening-feedback', isAuthenticated, asyncHandler(async (req, res) => {
    // Validate with extended schema that includes decoderType/rating constraints
    const feedbackSchema = insertScreeningFeedbackSchema.extend({
      decoderType: z.enum(['credit', 'criminal_eviction']),
      rating: z.enum(['helpful', 'not_helpful']),
      questionText: z.string().min(1).max(500),
      cautionLevel: z.enum(['low', 'medium', 'high']).nullable().optional(),
      classifiedTopic: z.string().max(100).nullable().optional(),
    });

    const parseResult = feedbackSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        message: "Invalid feedback data",
        errors: parseResult.error.flatten().fieldErrors 
      });
    }

    const { decoderType, questionText, cautionLevel, classifiedTopic, rating } = parseResult.data;
    const userId = (req as any).userId || null;

    await db.insert(screeningFeedback).values({
      userId,
      decoderType,
      questionText,
      cautionLevel: cautionLevel || null,
      classifiedTopic: classifiedTopic || null,
      rating,
    });

    res.json({ success: true });
  }));
}
