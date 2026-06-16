import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { asyncHandler } from "../utils/validation";
import { STATE_ADVERSE_ACTION_REGISTRY } from "../states/adverseActionDisclosures";

export async function registerDenialDecisionRoutes(app: Express) {
  // Get cities by state
  app.get('/api/denial-decision/cities', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId } = req.query;
    if (!stateId) {
      return res.status(400).json({ message: "stateId is required" });
    }
    const cities = await storage.getCitiesByState(stateId as string);
    res.json(cities);
  }));

  // Get counties for a state (for denial decision wizard)
  app.get('/api/denial-decision/counties', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId } = req.query;
    if (!stateId) {
      return res.status(400).json({ message: "stateId is required" });
    }
    const countiesList = await storage.getCountiesByState(stateId as string);
    res.json(countiesList);
  }));

  // Get all known jurisdictions for dropdown fallback
  app.get('/api/denial-decision/jurisdictions', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId } = req.query;
    const { getAllKnownJurisdictions } = await import("../services/jurisdictionResolver");
    const jurisdictions = await getAllKnownJurisdictions(stateId as string | undefined);
    res.json(jurisdictions);
  }));

  // Resolve jurisdiction from property
  app.get('/api/denial-decision/resolve-jurisdiction', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { propertyId, stateId, cityName, countyName } = req.query;
    const { resolveJurisdictionFromProperty, resolveJurisdictionFromLocation } = await import("../services/jurisdictionResolver");
    
    let resolved;
    if (propertyId) {
      resolved = await resolveJurisdictionFromProperty(propertyId as string);
      if (!resolved) {
        return res.status(404).json({ message: "Property not found or missing state" });
      }
    } else if (stateId) {
      resolved = await resolveJurisdictionFromLocation(
        stateId as string,
        cityName as string | undefined,
        countyName as string | undefined
      );
    } else {
      return res.status(400).json({ message: "Either propertyId or stateId is required" });
    }
    
    res.json(resolved);
  }));

  // Get audit history for the current user
  app.get('/api/denial-decision/audit-history', isAuthenticated, asyncHandler(async (req: any, res) => {
    const logs = await storage.getDenialDecisionAuditLogs(req.user.id);
    res.json(logs);
  }));

  // Delete an audit history entry
  app.delete('/api/denial-decision/audit-history/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const deleted = await storage.deleteDenialDecisionAuditLog(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ message: "Entry not found or not authorized" });
    }
    res.json({ success: true });
  }));

  // Update an audit history entry
  app.patch('/api/denial-decision/audit-history/:id', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { applicantName, outcome } = req.body;
    
    if (outcome && !['approve', 'conditional', 'deny'].includes(outcome)) {
      return res.status(400).json({ message: "Invalid outcome value" });
    }
    
    const updated = await storage.updateDenialDecisionAuditLog(id, req.user.id, { applicantName, outcome });
    if (!updated) {
      return res.status(404).json({ message: "Entry not found or not authorized" });
    }
    res.json(updated);
  }));

  // Get all denial criteria with rules for a jurisdiction
  app.get('/api/denial-decision/criteria', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { stateId, cityId, countyId } = req.query;
    if (!stateId) {
      return res.status(400).json({ message: "stateId is required" });
    }

    // Get all criteria
    const criteria = await storage.getAllDenialCriteria();
    
    // Get rules for this jurisdiction (city, county, state chain)
    const rules = await storage.getDenialCriteriaRulesForJurisdiction(
      stateId as string, 
      cityId as string | undefined,
      countyId as string | undefined
    );

    // Build a map of criteriaId -> most specific rule
    // Priority: City (4) > County (2) > State (1) > Federal (0)
    const ruleMap = new Map<string, any>();
    for (const rule of rules) {
      const existing = ruleMap.get(rule.criteriaId);
      if (!existing) {
        ruleMap.set(rule.criteriaId, rule);
      } else {
        // Calculate specificity: city beats county beats state beats federal
        const getSpecificity = (r: any) => 
          (r.cityId ? 4 : 0) + (r.countyId ? 2 : 0) + (r.stateId ? 1 : 0);
        const existingSpecificity = getSpecificity(existing);
        const newSpecificity = getSpecificity(rule);
        if (newSpecificity > existingSpecificity) {
          ruleMap.set(rule.criteriaId, rule);
        }
      }
    }

    // Group criteria by category with their rules
    const grouped: Record<string, Array<{
      id: string;
      code: string;
      label: string;
      description: string | null;
      status: 'blocked' | 'allowed' | 'conditional';
      explanationPlain: string | null;
      whyItMatters: string | null;
      legalAlternative: string | null;
      requiredSteps: string[] | null;
    }>> = {};

    for (const criterion of criteria) {
      const rule = ruleMap.get(criterion.id);
      const status = rule?.status || 'allowed'; // Default to allowed if no rule
      
      if (!grouped[criterion.category]) {
        grouped[criterion.category] = [];
      }
      
      grouped[criterion.category].push({
        id: criterion.id,
        code: criterion.code,
        label: criterion.label,
        description: criterion.description,
        status,
        explanationPlain: rule?.explanationPlain || null,
        whyItMatters: rule?.whyItMatters || null,
        legalAlternative: rule?.legalAlternative || null,
        requiredSteps: rule?.requiredSteps || null,
      });
    }

    res.json(grouped);
  }));

  // Get sentence templates for selected criteria
  app.get('/api/denial-decision/sentence-templates', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { criteriaIds, stateId, cityId } = req.query;
    
    if (!criteriaIds || !stateId) {
      return res.status(400).json({ message: "criteriaIds and stateId are required" });
    }

    const ids = Array.isArray(criteriaIds) ? criteriaIds : [criteriaIds];
    const templates = await storage.getDenialSentenceTemplates(
      ids as string[],
      stateId as string,
      cityId as string | undefined
    );

    res.json(templates);
  }));

  // Generate combined denial text
  app.post('/api/denial-decision/generate-text', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { criteriaIds, stateId, cityId } = req.body;
    
    if (!criteriaIds || !Array.isArray(criteriaIds) || criteriaIds.length === 0) {
      return res.status(400).json({ message: "criteriaIds must be a non-empty array" });
    }
    if (!stateId) {
      return res.status(400).json({ message: "stateId is required" });
    }

    // SERVER-SIDE ENFORCEMENT: Check for blocked criteria and reject them
    const rules = await storage.getDenialCriteriaRulesForJurisdiction(stateId, cityId);
    const ruleMap = new Map<string, any>();
    for (const rule of rules) {
      const existing = ruleMap.get(rule.criteriaId);
      if (!existing) {
        ruleMap.set(rule.criteriaId, rule);
      } else {
        const existingSpecificity = (existing.cityId ? 2 : 0) + (existing.stateId ? 1 : 0);
        const newSpecificity = (rule.cityId ? 2 : 0) + (rule.stateId ? 1 : 0);
        if (newSpecificity > existingSpecificity) {
          ruleMap.set(rule.criteriaId, rule);
        }
      }
    }

    // Filter out blocked criteria - they cannot be used for denial
    const blockedCriteriaUsed = criteriaIds.filter((id: string) => {
      const rule = ruleMap.get(id);
      return rule?.status === 'blocked';
    });

    if (blockedCriteriaUsed.length > 0) {
      return res.status(400).json({ 
        message: "Cannot use blocked criteria for denial decisions",
        blockedCriteriaIds: blockedCriteriaUsed
      });
    }

    const templates = await storage.getDenialSentenceTemplates(criteriaIds, stateId, cityId);
    
    // Pick the most specific template for each criterion (city > state > universal)
    const templateMap = new Map<string, any>();
    for (const template of templates) {
      const existing = templateMap.get(template.criteriaId);
      if (!existing) {
        templateMap.set(template.criteriaId, template);
      } else {
        const existingSpecificity = (existing.cityId ? 2 : 0) + (existing.stateId ? 1 : 0) + (existing.isDefault ? 0 : 0.5);
        const newSpecificity = (template.cityId ? 2 : 0) + (template.stateId ? 1 : 0) + (template.isDefault ? 0 : 0.5);
        if (newSpecificity > existingSpecificity) {
          templateMap.set(template.criteriaId, template);
        }
      }
    }

    // Combine sentences
    const sentences = Array.from(templateMap.values()).map(t => t.sentenceText);
    const combinedText = sentences.join(' ');

    res.json({ 
      text: combinedText,
      sentences,
      templateCount: sentences.length 
    });
  }));

  // Save decision to audit log
  app.post('/api/denial-decision/save', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { 
      stateId, 
      cityId,
      countyId, 
      outcome, 
      criteriaPresent, 
      criteriaSelected, 
      generatedText,
      conditions,
      fairChanceSteps,
      applicantName,
      propertyId,
      noticesProvided
    } = req.body;

    if (!stateId || !outcome || !criteriaPresent) {
      return res.status(400).json({ message: "stateId, outcome, and criteriaPresent are required" });
    }

    if (!['approve', 'conditional', 'deny'].includes(outcome)) {
      return res.status(400).json({ message: "outcome must be 'approve', 'conditional', or 'deny'" });
    }

    // Get city name if cityId is provided
    let cityName: string | undefined;
    if (cityId) {
      const city = await storage.getCity(cityId);
      cityName = city?.name;
    }

    // Get county name if countyId is provided
    let countyName: string | undefined;
    if (countyId) {
      const county = await storage.getCounty(countyId);
      countyName = county?.name;
    }

    // Create a version hash from current rules (now including county)
    const rules = await storage.getDenialCriteriaRulesForJurisdiction(stateId, cityId, countyId);
    
    // SERVER-SIDE ENFORCEMENT: Build rule map and check for blocked criteria in denial
    // Priority: City (4) > County (2) > State (1) > Federal (0)
    const ruleMap = new Map<string, any>();
    for (const rule of rules) {
      const existing = ruleMap.get(rule.criteriaId);
      if (!existing) {
        ruleMap.set(rule.criteriaId, rule);
      } else {
        const getSpecificity = (r: any) => 
          (r.cityId ? 4 : 0) + (r.countyId ? 2 : 0) + (r.stateId ? 1 : 0);
        const existingSpecificity = getSpecificity(existing);
        const newSpecificity = getSpecificity(rule);
        if (newSpecificity > existingSpecificity) {
          ruleMap.set(rule.criteriaId, rule);
        }
      }
    }

    // If outcome is deny, ensure no blocked criteria are in the selected list
    if (outcome === 'deny' && criteriaSelected && Array.isArray(criteriaSelected)) {
      const blockedCriteriaUsed = criteriaSelected.filter((id: string) => {
        const rule = ruleMap.get(id);
        return rule?.status === 'blocked';
      });

      if (blockedCriteriaUsed.length > 0) {
        return res.status(400).json({ 
          message: "Cannot use blocked criteria for denial decisions",
          blockedCriteriaIds: blockedCriteriaUsed
        });
      }
    }

    // Create rule version with snapshot of active rules
    const ruleVersion = `v${Date.now()}_${rules.length}rules`;

    const auditLog = await storage.createDenialDecisionAuditLog({
      userId: req.user.id,
      propertyId: propertyId || null,
      applicantName: applicantName || null,
      stateId,
      countyId: countyId || null,
      countyName: countyName || null,
      cityId: cityId || null,
      cityName: cityName || null,
      ruleVersion,
      outcome,
      criteriaPresent,
      criteriaSelectedForDenial: criteriaSelected || null,
      blockedCriteriaShown: null, // Could be populated if needed
      generatedDenialText: generatedText || null,
      adverseActionLetterGenerated: false,
      adverseActionLetterId: null,
      conditions: conditions || null,
      fairChanceStepsCompleted: fairChanceSteps || null,
      noticesProvided: noticesProvided || null,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });

    res.status(201).json(auditLog);
  }));

  // Update user's preferred city
  app.patch('/api/user/preferred-city', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { cityId } = req.body;
    
    // cityId can be null to clear the preference
    const user = await storage.updateUserPreferredCity(req.user.id, cityId || null);
    res.json(user);
  }));

  // Generate adverse action letter PDF (FCRA or non-FCRA)
  app.post('/api/denial-decision/adverse-action-letter', isAuthenticated, asyncHandler(async (req: any, res) => {
    const { 
      applicantName, 
      applicantAddress, 
      stateId, 
      cityId,
      countyId,
      denialReasons,
      criteriaIds,
      isFcra = true,
      letterType = 'adverse', // 'pre-adverse', 'adverse', or 'denial'
      auditLogId
    } = req.body;

    const isPreAdverse = letterType === 'pre-adverse';

    if (!stateId || !denialReasons) {
      return res.status(400).json({ message: "stateId and denialReasons are required" });
    }
    
    // Update audit log with the letter type if auditLogId is provided
    if (auditLogId) {
      try {
        const letterTypeDb = isPreAdverse ? 'pre_adverse' : 'adverse_action';
        await storage.updateDenialDecisionAuditLogLetterType(auditLogId, req.user.id, letterTypeDb);
      } catch (err) {
        console.error('Failed to update audit log with letter type:', err);
        // Don't fail the request, just log the error
      }
    }
    
    // Get jurisdiction info for disclosure (built separately from existing state/city lookups below)
    let jurisdictionDisclosure = '';
    if (cityId) {
      const cityInfo = await storage.getCity(cityId);
      if (cityInfo) {
        jurisdictionDisclosure = `${cityInfo.name}, `;
      }
    }
    if (countyId) {
      const countyInfo = await storage.getCounty(countyId);
      if (countyInfo) {
        jurisdictionDisclosure += `${countyInfo.name}, `;
      }
    }
    const stateInfo = await storage.getStateById(stateId);
    if (stateInfo) {
      jurisdictionDisclosure += stateInfo.name;
    }

    // Plain-text reason hygiene for adverse action letters (rendered via pdf-lib, no HTML escaping)
    let reasonsText: string[] = [];
    if (isPreAdverse) {
      reasonsText = ['Certain information in the consumer report may not meet the qualification requirements for this property.'];
    } else {
      const reasonLines = denialReasons.split('\n').filter((r: string) => r.trim().length > 0).slice(0, 5);
      reasonsText = reasonLines.map((reason: string) => {
        let s = reason.trim();
        s = s.replace(/bad credit/gi, 'credit history did not meet minimum criteria');
        s = s.replace(/poor credit/gi, 'credit history did not meet minimum criteria');
        s = s.replace(/low credit score/gi, 'credit score below required threshold');
        s = s.replace(/insufficient credit/gi, 'insufficient credit history to verify');
        s = s.replace(/too many late payments/gi, 'payment history did not meet criteria');
        s = s.replace(/bankruptcy/gi, 'bankruptcy filing within specified timeframe');
        s = s.replace(/criminal record/gi, 'criminal history pursuant to individualized assessment presents a documented risk to resident safety or property');
        s = s.replace(/arrest record/gi, 'conviction record pursuant to individualized assessment');
        s = s.replace(/eviction history/gi, 'prior eviction judgment within specified timeframe');
        s = s.replace(/evicted before/gi, 'prior eviction judgment within specified timeframe');
        s = s.replace(/not enough income/gi, 'income did not meet required threshold');
        s = s.replace(/income too low/gi, 'income did not meet required threshold');
        return s;
      });
      if (reasonsText.length === 0) {
        reasonsText = ['Information obtained during the screening process did not meet the qualification requirements for this property.'];
      }
    }

    const state = await storage.getStateById(stateId);
    let city = null;
    if (cityId) city = await storage.getCity(cityId);
    const jurisdictionLabel = city ? `${city.name}, ${state?.name}` : state?.name || '';
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const CRA = {
      name: 'Western Verify LLC',
      address: '489 W South Jordan Pkwy, Suite 200, South Jordan, UT 84095',
      phone: '(888) 610-WEST',
      website: 'www.westernverify.com',
      email: 'support@westernverify.com',
    };

    let letterTitle: string;
    let letterSubtitle: string;
    if (isPreAdverse) {
      letterTitle = 'PRE-ADVERSE ACTION NOTICE';
      letterSubtitle = 'Preliminary Rental Application Decision';
    } else if (isFcra) {
      letterTitle = 'ADVERSE ACTION NOTICE';
      letterSubtitle = 'Rental Application Decision';
    } else {
      letterTitle = 'RENTAL APPLICATION DENIAL';
      letterSubtitle = '';
    }

    const recipientName = applicantName || 'Applicant';
    const recipientAddress = applicantAddress || '';

    // PDF built with pdf-lib (Puppeteer/Chromium hangs in prod)
    const { PdfDocBuilder, PDF_COLORS } = await import('../utils/pdfDocBuilder');
    const b = await PdfDocBuilder.create();

    b.paragraph(letterTitle, { size: 18, bold: true, center: true, color: PDF_COLORS.dark });
    if (letterSubtitle) b.paragraph(letterSubtitle, { size: 11, center: true, color: PDF_COLORS.gray });
    b.rule(PDF_COLORS.dark, 1.5);

    b.moveDown(6);
    b.paragraph(recipientName, { bold: true });
    if (recipientAddress) {
      for (const part of recipientAddress.split(',').map((s: string) => s.trim()).filter(Boolean)) {
        b.paragraph(part, { size: 10 });
      }
    }
    b.paragraph(dateStr, { size: 10, color: PDF_COLORS.gray });

    b.moveDown(6);
    b.paragraph(`Dear ${recipientName},`);
    if (isPreAdverse) {
      b.paragraph('We are considering denying your rental application based, in whole or in part, on information obtained from a consumer reporting agency. This is not a final decision.');
      b.paragraph('If you believe the information in the consumer report is inaccurate or incomplete, you may contact the consumer reporting agency listed below as soon as possible.');
    } else {
      b.paragraph(`We regret to inform you that your rental application has been denied${isFcra ? ' based, in whole or in part, on information obtained from a consumer reporting agency' : ''}.`);
    }

    b.sectionTitle(isPreAdverse ? 'Reason(s) Under Consideration' : 'Reason(s) for Denial');
    for (const r of reasonsText) b.bullet(r);

    if (isFcra || isPreAdverse) {
      b.sectionTitle('Consumer Reporting Agency');
      b.paragraph(CRA.name, { bold: true, size: 10 });
      b.paragraph(CRA.address, { size: 10 });
      b.paragraph(`Phone: ${CRA.phone}`, { size: 10 });
      b.paragraph(`Email: ${CRA.email}`, { size: 10 });
      b.paragraph(`Website: ${CRA.website}`, { size: 10 });
      b.paragraph('The consumer reporting agency did not make this decision and cannot explain why it was made.', { size: 9, italic: true, color: PDF_COLORS.gray });

      b.sectionTitle('Your Rights');
      b.bullet('You may obtain a free copy of your consumer report within 60 days by contacting the agency above.', { size: 10 });
      b.bullet('You have the right to dispute the accuracy or completeness of any information in your report.', { size: 10 });
      if (isPreAdverse) b.bullet('If you believe any information is inaccurate, please contact the consumer reporting agency as soon as possible before a final decision is made.', { size: 10 });
      b.bullet(`You may have additional rights under ${jurisdictionLabel || 'state'} law.`, { size: 10 });
    } else {
      b.paragraph('If you have questions about this decision, please contact the property manager.', { size: 10 });
    }

    const stateReq = stateId ? STATE_ADVERSE_ACTION_REGISTRY[stateId] : undefined;
    if (stateReq) {
      b.sectionTitle(`State-Specific Rights (${stateId})`);
      if (stateReq.statutes.length > 0) {
        b.paragraph('Applicable State Laws:', { bold: true, size: 10 });
        for (const s of stateReq.statutes) b.bullet(s, { size: 9 });
      }
      if (stateReq.disclosures.length > 0) {
        b.paragraph('Additional State Disclosures:', { bold: true, size: 10 });
        for (const d of stateReq.disclosures) b.bullet(d, { size: 10 });
      }
      if (stateReq.sourceOfIncomeProtection) b.paragraph(`Source of Income Protection: ${stateReq.sourceOfIncomeProtection}`, { size: 9 });
      if (stateReq.fairChanceRequirements) b.paragraph(`Fair Chance Notice: ${stateReq.fairChanceRequirements}`, { size: 9 });
      if (stateReq.localOrdinanceNote) b.paragraph(`Note: ${stateReq.localOrdinanceNote}`, { size: 8, italic: true, color: PDF_COLORS.gray });
    }

    b.moveDown(16);
    b.paragraph('Sincerely,');
    b.moveDown(24);
    b.paragraph('___________________________', { color: PDF_COLORS.gray });
    b.paragraph('Property Manager / Owner', { size: 10 });

    const footerLaw = isPreAdverse
      ? 'This notice is provided in accordance with the Fair Credit Reporting Act (15 U.S.C. 1681m(a))'
      : isFcra
        ? 'This notice is provided in accordance with the Fair Credit Reporting Act (15 U.S.C. 1681m)'
        : 'This notice is provided for your records';
    b.footer([`${footerLaw}${jurisdictionLabel ? ` and applicable ${jurisdictionLabel} fair housing laws` : ''}.`]);

    const pdfBuffer = await b.toBuffer();
    const filename = isFcra
      ? `adverse-action-letter-${new Date().toISOString().split('T')[0]}.pdf`
      : `denial-notice-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  }));

  // Admin: Get coverage report (all states x topics matrix)
  app.get('/api/admin/state-notes/coverage', isAuthenticated, requireAdmin, asyncHandler(async (req: any, res) => {
    const coverage = await storage.getStateNotesCoverage();
    const allStates = await storage.getAllStates();
    
    // Import topics from shared module
    const { 
      CREDIT_TOPICS, 
      CRIMINAL_EVICTION_TOPICS, 
      HIGH_RISK_TOPICS,
      REQUIRED_CREDIT_TOPICS,
      REQUIRED_CRIMINAL_EVICTION_TOPICS,
    } = await import('@shared/decoderTopics');
    
    // Build full coverage matrix
    const matrix: Array<{
      stateId: string;
      stateName: string;
      decoder: string;
      topic: string;
      hasApproved: boolean;
      lastReviewedAt: Date | null;
      isHighRisk: boolean;
      isRequired: boolean;
    }> = [];
    
    // Per-state decoder-ready status
    const stateStatus: Array<{
      stateId: string;
      stateName: string;
      decoderNotesReady: boolean;
      requiredCriminalEvictionApproved: number;
      requiredCriminalEvictionTotal: number;
      requiredCreditApproved: number;
      requiredCreditTotal: number;
      isActuallyReady: boolean;
    }> = [];
    
    for (const state of allStates.filter(s => s.isActive)) {
      let requiredCriminalEvictionApproved = 0;
      let requiredCreditApproved = 0;
      
      // Credit topics
      for (const topic of CREDIT_TOPICS) {
        const existing = coverage.find(c => c.stateId === state.id && c.decoder === 'credit' && c.topic === topic);
        const isRequired = REQUIRED_CREDIT_TOPICS.includes(topic as any);
        const hasApproved = existing?.hasApproved || false;
        
        if (isRequired && hasApproved) requiredCreditApproved++;
        
        matrix.push({
          stateId: state.id,
          stateName: state.name,
          decoder: 'credit',
          topic,
          hasApproved,
          lastReviewedAt: existing?.lastReviewedAt || null,
          isHighRisk: HIGH_RISK_TOPICS.includes(topic as any),
          isRequired,
        });
      }
      
      // Criminal/eviction topics
      for (const topic of CRIMINAL_EVICTION_TOPICS) {
        const existing = coverage.find(c => c.stateId === state.id && c.decoder === 'criminal_eviction' && c.topic === topic);
        const isRequired = REQUIRED_CRIMINAL_EVICTION_TOPICS.includes(topic as any);
        const hasApproved = existing?.hasApproved || false;
        
        if (isRequired && hasApproved) requiredCriminalEvictionApproved++;
        
        matrix.push({
          stateId: state.id,
          stateName: state.name,
          decoder: 'criminal_eviction',
          topic,
          hasApproved,
          lastReviewedAt: existing?.lastReviewedAt || null,
          isHighRisk: HIGH_RISK_TOPICS.includes(topic as any),
          isRequired,
        });
      }
      
      // Compute actual readiness (all required topics approved)
      const isActuallyReady = 
        requiredCriminalEvictionApproved === REQUIRED_CRIMINAL_EVICTION_TOPICS.length &&
        requiredCreditApproved === REQUIRED_CREDIT_TOPICS.length;
      
      stateStatus.push({
        stateId: state.id,
        stateName: state.name,
        decoderNotesReady: state.decoderNotesReady || false,
        requiredCriminalEvictionApproved,
        requiredCriminalEvictionTotal: REQUIRED_CRIMINAL_EVICTION_TOPICS.length,
        requiredCreditApproved,
        requiredCreditTotal: REQUIRED_CREDIT_TOPICS.length,
        isActuallyReady,
      });
    }
    
    // Calculate summary stats
    const totalCells = matrix.length;
    const approvedCount = matrix.filter(m => m.hasApproved).length;
    const highRiskMissing = matrix.filter(m => m.isHighRisk && !m.hasApproved);
    const statesReady = stateStatus.filter(s => s.isActuallyReady).length;
    
    res.json({
      matrix,
      stateStatus,
      summary: {
        totalCells,
        approvedCount,
        coveragePercent: Math.round((approvedCount / totalCells) * 100),
        highRiskMissingCount: highRiskMissing.length,
        statesReady,
        statesTotal: stateStatus.length,
      }
    });
  }));
}
