import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { asyncHandler } from "../utils/validation";

export async function registerStateNotesRoutes(app: Express) {
  // Public endpoint: Get approved state note for decoder runtime
  app.get('/api/state-notes', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId, decoder, topic } = req.query;
    
    if (!stateId || !decoder || !topic) {
      return res.status(400).json({ message: "stateId, decoder, and topic are required" });
    }
    
    if (!['credit', 'criminal_eviction'].includes(decoder)) {
      return res.status(400).json({ message: "decoder must be 'credit' or 'criminal_eviction'" });
    }
    
    const note = await storage.getApprovedStateNote(stateId, decoder as 'credit' | 'criminal_eviction', topic);
    res.json({ note: note || null });
  }));

  // Admin: List all state notes with filters
  app.get('/api/admin/state-notes', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const { stateId, decoder, topic, status } = req.query;
    
    const filters: any = {};
    if (stateId) filters.stateId = stateId;
    if (decoder && ['credit', 'criminal_eviction'].includes(decoder)) filters.decoder = decoder;
    if (topic) filters.topic = topic;
    if (status) filters.status = status;
    
    const notes = await storage.getStateNotes(filters);
    res.json(notes);
  }));

  // Admin: Get single state note
  app.get('/api/admin/state-notes/:id', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const note = await storage.getStateNote(req.params.id);
    if (!note) {
      return res.status(404).json({ message: "State note not found" });
    }
    res.json(note);
  }));

  // Admin: Create new state note (draft)
  app.post('/api/admin/state-notes', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const { stateId, decoder, topic, title, bullets, sourceLinks } = req.body;
    
    if (!stateId || !decoder || !topic || !title || !bullets) {
      return res.status(400).json({ message: "stateId, decoder, topic, title, and bullets are required" });
    }
    
    if (!['credit', 'criminal_eviction'].includes(decoder)) {
      return res.status(400).json({ message: "decoder must be 'credit' or 'criminal_eviction'" });
    }
    
    // Validate topic is from allowed list to prevent arbitrary topics
    const { CREDIT_TOPICS, CRIMINAL_EVICTION_TOPICS } = await import('@shared/decoderTopics');
    const allowedTopics = decoder === 'credit' ? CREDIT_TOPICS : CRIMINAL_EVICTION_TOPICS;
    if (!allowedTopics.includes(topic as any)) {
      return res.status(400).json({ message: `Invalid topic '${topic}' for ${decoder} decoder. Allowed: ${allowedTopics.join(', ')}` });
    }
    
    if (!Array.isArray(bullets) || bullets.length === 0) {
      return res.status(400).json({ message: "bullets must be a non-empty array of strings" });
    }
    
    const note = await storage.createStateNote({
      stateId,
      decoder,
      topic,
      title,
      bullets,
      sourceLinks: sourceLinks || [],
      status: 'draft',
      isActive: false,
      version: 1,
    });
    
    res.status(201).json(note);
  }));

  // Admin: Update state note (only drafts can be edited)
  app.put('/api/admin/state-notes/:id', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const existing = await storage.getStateNote(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "State note not found" });
    }
    
    if (existing.status !== 'draft') {
      return res.status(400).json({ message: "Only draft notes can be edited. Create a new version instead." });
    }
    
    const { title, bullets, sourceLinks } = req.body;
    const updateData: any = {};
    if (title) updateData.title = title;
    if (bullets) updateData.bullets = bullets;
    if (sourceLinks !== undefined) updateData.sourceLinks = sourceLinks;
    
    const updated = await storage.updateStateNote(req.params.id, updateData);
    res.json(updated);
  }));

  // Admin: Submit state note for review
  app.post('/api/admin/state-notes/:id/submit', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const note = await storage.submitStateNoteForReview(req.params.id);
    if (!note) {
      return res.status(400).json({ message: "Note not found or not in draft status" });
    }
    res.json(note);
  }));

  // Admin: Approve state note (requires approval checklist)
  app.post('/api/admin/state-notes/:id/approve', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const { approvalChecklist } = req.body;
    
    if (!approvalChecklist || typeof approvalChecklist !== 'object') {
      return res.status(400).json({ message: "approvalChecklist is required" });
    }
    
    // Validate all checklist items are checked
    const requiredChecks = [
      'contentAccuracy',
      'neutralFraming',
      'fairHousingCompliance',
      'toneConsistency',
      'auditTrailComplete',
    ];
    
    const allChecked = requiredChecks.every(key => approvalChecklist[key] === true);
    if (!allChecked) {
      return res.status(400).json({ message: "All approval checklist items must be checked" });
    }
    
    const note = await storage.approveStateNote(req.params.id, req.user.id, approvalChecklist);
    if (!note) {
      return res.status(400).json({ message: "Note not found or approval failed" });
    }
    res.json(note);
  }));

  // Admin: Archive state note
  app.post('/api/admin/state-notes/:id/archive', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const note = await storage.archiveStateNote(req.params.id);
    if (!note) {
      return res.status(404).json({ message: "State note not found" });
    }
    res.json(note);
  }));
}
