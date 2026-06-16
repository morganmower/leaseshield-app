import type { Express } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated, requireAccess } from "../jwtAuth";
import { db } from "../db";
import { emailService } from "../emailService";
import { getUserId, updateSubmissionStatusFromScreening } from "./_shared";

export async function registerRentalScreeningRoutes(app: Express) {
  // Get all screening orders for a submission (per-person model)
  app.get('/api/rental/submissions/:id/screening', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Return all screening orders for this submission (per-person)
      const screeningOrders = await storage.getRentalScreeningOrdersBySubmission(submission.id);
      res.json(screeningOrders);
    } catch (error) {
      console.error("Error getting screening orders:", error);
      res.status(500).json({ message: "Failed to get screening orders" });
    }
  });

  // Download consent authorization PDF for a specific person
  app.get('/api/rental/submissions/:id/person/:personId/consent-pdf', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the person
      const people = await storage.getRentalSubmissionPeople(submission.id);
      const person = people.find(p => p.id === req.params.personId);
      
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      if (!person.fcraAuthorized) {
        return res.status(400).json({ message: "This person has not authorized a background check" });
      }

      // Generate the consent record as a PDF with pdf-lib. We intentionally do
      // NOT use Puppeteer/Chromium here: in the deployed environment Chromium is
      // not available, so the headless browser hung and the request timed out
      // ("Download failed" for the landlord). pdf-lib is pure JS and reliable.
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

      const consentDate = person.fcraAuthorizedTimestamp
        ? new Date(person.fcraAuthorizedTimestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZoneName: 'short',
          })
        : 'Unknown';

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      const teal = rgb(0.05, 0.58, 0.53);
      const dark = rgb(0.1, 0.1, 0.1);
      const gray = rgb(0.42, 0.45, 0.5);
      const green = rgb(0.09, 0.4, 0.2);

      const PAGE_W = 612;
      const PAGE_H = 792;
      const MARGIN = 50;
      const CONTENT_W = PAGE_W - MARGIN * 2;

      let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      let y = PAGE_H - MARGIN;

      // Standard PDF fonts use WinAnsi encoding and throw on characters they
      // cannot encode, so strip anything outside printable ASCII.
      const safe = (str: any): string =>
        String(str ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

      const ensureSpace = (needed: number) => {
        if (y - needed < MARGIN) {
          page = pdfDoc.addPage([PAGE_W, PAGE_H]);
          y = PAGE_H - MARGIN;
        }
      };

      const wrapLines = (text: string, f: any, size: number, maxWidth: number): string[] => {
        const words = safe(text).split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        return lines.length ? lines : [''];
      };

      const drawParagraph = (
        text: string,
        opts: { size?: number; f?: any; color?: any; x?: number; width?: number; gap?: number; center?: boolean } = {}
      ) => {
        const size = opts.size ?? 11;
        const f = opts.f ?? font;
        const color = opts.color ?? dark;
        const x = opts.x ?? MARGIN;
        const width = opts.width ?? CONTENT_W;
        const gap = opts.gap ?? 4;
        for (const ln of wrapLines(text, f, size, width)) {
          ensureSpace(size + gap);
          y -= size;
          let drawX = x;
          if (opts.center) {
            const w = f.widthOfTextAtSize(ln, size);
            drawX = MARGIN + (CONTENT_W - w) / 2;
          }
          page.drawText(ln, { x: drawX, y, size, font: f, color });
          y -= gap;
        }
      };

      const sectionTitle = (t: string) => {
        ensureSpace(24);
        y -= 18;
        page.drawText(safe(t.toUpperCase()), { x: MARGIN, y, size: 11, font: fontBold, color: teal });
        y -= 8;
      };

      const drawFieldRow = (l1: string, v1: string, l2?: string, v2?: string) => {
        const col2X = MARGIN + CONTENT_W / 2 + 10;
        const colW = CONTENT_W / 2 - 10;
        // Wrap each value within its column so long inputs (e.g. a long email
        // address or name) can never overflow into the adjacent column.
        const v1Lines = wrapLines(v1, font, 11, colW);
        const v2Lines = v2 !== undefined ? wrapLines(v2, font, 11, colW) : [];
        const valueLineCount = Math.max(v1Lines.length, v2Lines.length, 1);
        ensureSpace(12 + 14 + valueLineCount * 15 + 6);
        y -= 12;
        page.drawText(safe(l1.toUpperCase()), { x: MARGIN, y, size: 8, font: fontBold, color: gray });
        if (l2) page.drawText(safe(l2.toUpperCase()), { x: col2X, y, size: 8, font: fontBold, color: gray });
        const valueTopY = y - 14;
        v1Lines.forEach((ln, i) => {
          page.drawText(ln, { x: MARGIN, y: valueTopY - i * 15, size: 11, font, color: dark });
        });
        v2Lines.forEach((ln, i) => {
          page.drawText(ln, { x: col2X, y: valueTopY - i * 15, size: 11, font, color: dark });
        });
        y = valueTopY - (valueLineCount - 1) * 15 - 6;
      };

      const drawBullet = (t: string) => {
        ensureSpace(16);
        const startY = y;
        page.drawText('-', { x: MARGIN + 6, y: startY - 11, size: 11, font, color: dark });
        drawParagraph(t, { x: MARGIN + 18, width: CONTENT_W - 18, gap: 4 });
      };

      // Header
      drawParagraph('Background Check Authorization', { size: 20, f: fontBold, color: teal, center: true });
      drawParagraph('Rental Application Consent Record', { size: 13, color: gray, center: true });
      y -= 6;
      ensureSpace(14);
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_W - MARGIN, y },
        thickness: 1.5,
        color: teal,
      });
      y -= 6;

      // Applicant information
      sectionTitle('Applicant Information');
      const roleText = person.role === 'applicant'
        ? 'Primary Applicant'
        : person.role === 'coapplicant'
          ? 'Co-Applicant'
          : 'Guarantor';
      drawFieldRow('Full Name', `${person.firstName} ${person.lastName}`, 'Email Address', person.email || '');
      drawFieldRow(
        'Role',
        roleText,
        'Application Date',
        new Date(person.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      );

      // Property information
      sectionTitle('Property Information');
      drawFieldRow('Property', property.name || '', 'Unit', unit.unitLabel || '');

      // Disclosure acknowledgment
      sectionTitle('Disclosure Acknowledgment');
      drawParagraph('By submitting this rental application, the applicant acknowledged the following:', { gap: 6 });
      drawBullet('A background screening may be requested in connection with the rental application');
      drawBullet('The screening authorization will be collected directly by Western Verify through its screening platform DigitalDelve');
      drawBullet('LeaseShield does not make rental decisions');
      drawBullet('The background screening report may include credit history, rental history, employment-related information, criminal records, and eviction records as permitted by law');
      y -= 4;
      drawParagraph('The applicant authorized the verification of the information provided, including background and credit screening where permitted by law.', { gap: 4 });

      // Authorization stamp box
      const sig = (person.formJson as any)?.typedSignature;
      const boxHeight = sig ? 104 : 64;
      ensureSpace(boxHeight + 16);
      y -= 10;
      const boxTopY = y;
      const boxBottomY = y - boxHeight;
      page.drawRectangle({
        x: MARGIN,
        y: boxBottomY,
        width: CONTENT_W,
        height: boxHeight,
        color: rgb(0.86, 0.99, 0.91),
        borderColor: rgb(0.13, 0.77, 0.37),
        borderWidth: 1.5,
      });
      const centerInBox = (txt: string, ty: number, size: number, f: any, color: any) => {
        const s = safe(txt);
        const w = f.widthOfTextAtSize(s, size);
        page.drawText(s, { x: MARGIN + (CONTENT_W - w) / 2, y: ty, size, font: f, color });
      };
      let ty = boxTopY - 24;
      centerInBox('AUTHORIZED', ty, 16, fontBold, green);
      ty -= 22;
      centerInBox(`Consent recorded: ${consentDate}`, ty, 11, font, dark);
      if (sig) {
        ty -= 24;
        centerInBox('Electronic Signature', ty, 9, font, gray);
        ty -= 22;
        centerInBox(String(sig), ty, 16, fontItalic, green);
      }
      y = boxBottomY - 14;

      // Disclaimer
      drawParagraph(
        'Important: This document serves as a record that the applicant acknowledged the background screening disclosure and authorized verification of their information during the rental application process. The actual background check authorization and consent are collected separately by Western Verify (DigitalDelve) in compliance with FCRA requirements.',
        { size: 10, color: rgb(0.57, 0.25, 0.05), gap: 4 }
      );

      // Footer
      y -= 16;
      ensureSpace(28);
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_W - MARGIN, y },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
      y -= 4;
      drawParagraph(
        `Generated by LeaseShield on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        { size: 9, color: gray, center: true, gap: 2 }
      );
      drawParagraph(`Submission ID: ${submission.id}`, { size: 9, color: gray, center: true, gap: 2 });

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="consent-authorization-${person.firstName}-${person.lastName}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating consent PDF:", error?.message || error);
      console.error("Error stack:", error?.stack);
      res.status(500).json({ message: "Failed to generate consent PDF", error: error?.message });
    }
  });

  // Download full rental application as PDF
  app.get('/api/rental/submissions/:id/application-pdf', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all people for this submission
      const people = await storage.getRentalSubmissionPeople(submission.id);
      const decision = await storage.getRentalDecision(submission.id);

      // Helpers
      const formatDate = (dateStr: any): string => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      };
      const roleLabel = (role: string): string => {
        switch (role) {
          case 'applicant': return 'Primary Applicant';
          case 'coapplicant': return 'Co-Applicant';
          case 'guarantor': return 'Guarantor';
          default: return role;
        }
      };

      // PDF built with pdf-lib (no Chromium dependency; Puppeteer hangs in prod).
      const { PdfDocBuilder, PDF_COLORS } = await import('../utils/pdfDocBuilder');
      const b = await PdfDocBuilder.create();

      b.title('Rental Application');
      b.subtitle(`Submitted ${formatDate(submission.createdAt)}`);
      b.rule();

      b.sectionTitle('Property Information');
      b.fieldGrid([
        { label: 'Property', value: property.name },
        { label: 'Unit', value: unit.unitLabel },
        { label: 'Status', value: submission.status },
      ], 3);

      // Terms & policies from the application link cover page
      const merged = (appLink as any).mergedSchemaJson as any;
      const propertyTerms = merged?.propertyTerms || {};
      const coverPage = merged?.coverPage || {};
      const coverSections: any[] = coverPage?.sections || [];
      const hasPropertyTerms = propertyTerms.monthlyRent || propertyTerms.applicationFee ||
        propertyTerms.securityDeposit || propertyTerms.adminFee || propertyTerms.additionalNotes;
      if (hasPropertyTerms) {
        b.h3('Property Terms & Fees');
        b.fieldGrid([
          { label: 'Monthly Rent', value: propertyTerms.monthlyRent },
          { label: 'Application Fee', value: propertyTerms.applicationFee },
          { label: 'Security Deposit', value: propertyTerms.securityDeposit },
          { label: 'Admin/Move-in Fee', value: propertyTerms.adminFee },
          { label: 'Lease Signing Deadline', value: propertyTerms.leaseSignDeadlineHours ? `${propertyTerms.leaseSignDeadlineHours} hours after approval` : '' },
        ], 2);
        if (propertyTerms.additionalNotes) {
          b.fieldGrid([{ label: 'Additional Notes', value: propertyTerms.additionalNotes }], 1);
        }
      }
      if (coverSections.length > 0) {
        b.h3('Application Requirements & Policies');
        for (const section of coverSections) {
          if (section?.heading) b.paragraph(section.heading, { bold: true, size: 11 });
          if (section?.body) b.paragraph(section.body, { size: 10, color: PDF_COLORS.gray });
        }
      }

      // Per-person sections
      people.forEach((person: any, index: number) => {
        const formData = person.formJson || {};
        if (index > 0) b.newPage();

        b.ensureSpace(28);
        b.moveDown(20);
        const nameText = b.safe(`${person.firstName || ''} ${person.lastName || ''}`.trim());
        b.page.drawText(nameText, { x: b.MARGIN, y: b.y, size: 15, font: b.fontBold, color: PDF_COLORS.dark });
        const nameW = b.fontBold.widthOfTextAtSize(nameText, 15);
        b.inlineBadge(roleLabel(person.role), b.MARGIN + nameW + 10, b.y);
        b.moveDown(6);

        b.h3('Contact Information');
        b.fieldGrid([
          { label: 'Email', value: person.email },
          { label: 'Phone', value: formData.phone },
          { label: 'Date of Birth', value: formData.dateOfBirth },
          { label: "Driver's License", value: formData.driversLicense },
          { label: 'Desired Move-in', value: formData.desiredMoveInDate ? formatDate(formData.desiredMoveInDate) : '' },
          { label: 'Housing Voucher', value: formData.hasHousingVoucher !== undefined ? (formData.hasHousingVoucher ? `Yes${formData.voucherType ? ` - ${formData.voucherType}` : ''}` : 'No') : '' },
          { label: 'Referral Source', value: formData.referralSource ? (formData.referralSource === 'other' ? (formData.referralSourceOther || 'Other') : String(formData.referralSource).replace(/_/g, ' ')) : '' },
        ], 2);

        if (Array.isArray(formData.occupants) && formData.occupants.length > 0) {
          b.h3('Additional Occupants');
          formData.occupants.forEach((occ: any, idx: number) => {
            const parts = [occ.name || `Occupant ${idx + 1}`];
            if (occ.relationship) parts.push(occ.relationship);
            const line = parts.join(' - ') + (occ.age ? ` (Age: ${occ.age})` : '');
            b.bullet(line);
          });
        }

        if (formData.currentAddress) {
          b.h3('Current Residence');
          const addr = `${formData.currentAddress}${formData.currentCity ? `, ${formData.currentCity}` : ''}${formData.currentState ? `, ${formData.currentState}` : ''} ${formData.currentZip || ''}`.trim();
          b.fieldGrid([
            { label: 'Address', value: addr },
            { label: 'Landlord Name', value: formData.currentLandlordName },
            { label: 'Landlord Phone', value: formData.currentLandlordPhone },
            { label: 'Current Rent', value: formData.currentRent ? `$${formData.currentRent}/mo` : '' },
            { label: 'Move-In Date', value: formData.moveInDate },
            { label: 'Reason for Moving', value: formData.reasonForMoving },
          ], 2);
        }

        if (formData.currentEmployer || formData.monthlyIncome) {
          b.h3('Employment & Income');
          b.fieldGrid([
            { label: 'Employer', value: formData.currentEmployer },
            { label: 'Employer Phone', value: formData.employerPhone },
            { label: 'Job Title', value: formData.jobTitle },
            { label: 'Monthly Income', value: formData.monthlyIncome ? `$${formData.monthlyIncome}` : '' },
            { label: 'Time at Job', value: formData.employmentLength },
            { label: 'Additional Income', value: formData.additionalIncome ? `$${formData.additionalIncome} (${formData.additionalIncomeSource || 'Other'})` : '' },
          ], 2);
        }

        if (formData.emergencyContactName || formData.emergencyContactPhone) {
          b.h3('Emergency Contact');
          b.fieldGrid([
            { label: 'Name', value: formData.emergencyContactName },
            { label: 'Phone', value: formData.emergencyContactPhone },
            { label: 'Relationship', value: formData.emergencyContactRelationship },
          ], 2);
        }

        if (Array.isArray(formData.personalReferences) && formData.personalReferences.length > 0) {
          b.h3('Personal References');
          formData.personalReferences.forEach((ref: any, idx: number) => {
            let line = ref.name || `Reference ${idx + 1}`;
            if (ref.relationship) line += ` (${ref.relationship})`;
            const contact = [ref.phone ? `Phone: ${ref.phone}` : '', ref.email ? `Email: ${ref.email}` : ''].filter(Boolean).join('  ');
            if (contact) line += ` - ${contact}`;
            b.bullet(line);
          });
        }

        const hasAddl = formData.hasPets !== undefined || formData.smoker !== undefined ||
          formData.hasBeenEvicted !== undefined || formData.hasFelony !== undefined;
        if (hasAddl) {
          b.h3('Additional Information');
          const addlFields: { label: string; value: string }[] = [];
          if (formData.hasPets !== undefined) addlFields.push({ label: 'Has Pets', value: formData.hasPets ? 'Yes' : 'No' });
          if (formData.smoker !== undefined) addlFields.push({ label: 'Smoker', value: formData.smoker ? 'Yes' : 'No' });
          if (formData.hasBeenEvicted !== undefined) addlFields.push({ label: 'Prior Eviction', value: formData.hasBeenEvicted ? 'Yes' : 'No' });
          if (formData.hasFelony !== undefined) addlFields.push({ label: 'Felony Conviction', value: formData.hasFelony ? 'Yes' : 'No' });
          if (formData.smokesOrVapes !== undefined || formData.smoker !== undefined) addlFields.push({ label: 'Smokes/Vapes', value: (formData.smokesOrVapes ?? formData.smoker) ? 'Yes' : 'No' });
          b.fieldGrid(addlFields, 2);
          if (Array.isArray(formData.pets) && formData.pets.length > 0) {
            b.paragraph('Pets:', { size: 9, color: PDF_COLORS.gray });
            formData.pets.forEach((p: any) => {
              const line = `${p.type || ''} ${p.breed ? `(${p.breed})` : ''} ${p.weight ? `- ${p.weight} lbs` : ''} ${p.isServiceAnimal ? '- Service Animal' : ''}`.replace(/\s+/g, ' ').trim();
              if (line) b.bullet(line);
            });
          }
          if (Array.isArray(formData.vehicles) && formData.vehicles.length > 0) {
            b.paragraph('Vehicles:', { size: 9, color: PDF_COLORS.gray });
            formData.vehicles.forEach((v: any) => {
              const line = `${v.year || ''} ${v.make || ''} ${v.model || ''} ${v.color ? `(${v.color})` : ''} ${v.licensePlate ? `- ${v.licensePlate}` : ''}`.replace(/\s+/g, ' ').trim();
              if (line) b.bullet(line);
            });
          }
        }

        if (person.fcraAuthorized) {
          b.h3('Background Screening Disclosure & Acknowledgment');
          b.paragraph(`Acknowledged: ${formatDate(person.fcraAuthorizedTimestamp)}`, { size: 9, color: PDF_COLORS.amber, bold: true });
          b.paragraph('As part of the rental application process, the landlord or property manager may request a background screening report about you for housing purposes.', { size: 10 });
          b.paragraph('If screening is requested:', { size: 10, bold: true });
          b.bullet('You will receive a separate invitation directly from Western Verify, the consumer reporting agency, delivered through its screening platform DigitalDelve', { size: 10 });
          b.bullet('That invitation will include a standalone disclosure and authorization, which you must review and complete before any consumer report is obtained', { size: 10 });
          b.bullet('LeaseShield does not collect or store your Social Security number, date of birth, or screening authorization', { size: 10 });
          b.paragraph('The background screening report, if obtained, may include information permitted by law, such as credit history, rental history, employment-related information, criminal records, and eviction records.', { size: 10 });
          b.paragraph('Adverse Action Notice:', { size: 10, bold: true });
          b.paragraph('If adverse action is taken based in whole or in part on information contained in a consumer report, you will be provided an adverse action notice that includes:', { size: 10 });
          b.bullet('The name, address, and phone number of the consumer reporting agency (Western Verify) that provided the report', { size: 10 });
          b.bullet('A statement that the consumer reporting agency did not make the decision and cannot explain why the decision was made', { size: 10 });
          b.bullet('Notice of your rights under the Fair Credit Reporting Act (FCRA), including your right to obtain a free copy of your consumer report and to dispute inaccurate or incomplete information', { size: 10 });
          b.paragraph('By acknowledging, applicant confirmed:', { size: 10, bold: true });
          b.bullet('Understanding that a background screening may be requested in connection with the rental application', { size: 10 });
          b.bullet('Understanding that any screening authorization will be collected directly by Western Verify, through its screening platform DigitalDelve, and not by LeaseShield', { size: 10 });
          b.bullet('Understanding that LeaseShield does not make rental decisions', { size: 10 });
        } else {
          b.h3('Background Check Authorization');
          b.paragraph('Pending', { size: 10, color: PDF_COLORS.amber, bold: true });
        }
      });

      if (decision) {
        b.rule(decision.decision === 'approved' ? PDF_COLORS.green : PDF_COLORS.red, 1);
        b.sectionTitle(`Application ${decision.decision === 'approved' ? 'Approved' : 'Denied'}`);
        b.fieldGrid([{ label: 'Decision Date', value: formatDate(decision.decidedAt) }], 1);
        if (decision.notes) b.fieldGrid([{ label: 'Notes', value: decision.notes }], 1);
      }

      const acknowledgedPeople = people.filter((p: any) => p.propertyTermsAcknowledgedAt);
      if (acknowledgedPeople.length > 0) {
        b.sectionTitle('Acknowledgment Record');
        b.paragraph('The following individuals acknowledged the property terms, fees, and application requirements shown above:', { size: 10, color: PDF_COLORS.gray });
        acknowledgedPeople.forEach((person: any) => {
          b.bullet(`${person.firstName} ${person.lastName} (${roleLabel(person.role)}) acknowledged on ${formatDate(person.propertyTermsAcknowledgedAt)}`, { size: 10 });
        });
      }

      b.footer([
        `Generated by LeaseShield on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
        `Application ID: ${submission.id}`,
      ]);

      const primaryApplicant = people.find((p: any) => p.role === 'applicant');
      const pdfBuffer = await b.toBuffer();

      const fileName = primaryApplicant
        ? `rental-application-${primaryApplicant.firstName}-${primaryApplicant.lastName}.pdf`
        : `rental-application-${submission.id.slice(0, 8)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating application PDF:", error?.message || error);
      console.error("Error stack:", error?.stack);
      res.status(500).json({ message: "Failed to generate application PDF", error: error?.message });
    }
  });

  // Request screening for a specific person in a submission (per-person model)
  app.post('/api/rental/submissions/:id/screening', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const submission = await storage.getRentalSubmission(req.params.id);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify ownership
      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { personId, invitationId } = req.body;
      
      // Get all people for this submission
      const people = await storage.getRentalSubmissionPeople(submission.id);
      
      // Find the target person - either by personId or default to primary applicant
      let targetPerson;
      if (personId) {
        targetPerson = people.find(p => p.id === personId);
        if (!targetPerson) {
          return res.status(404).json({ message: "Person not found in this submission" });
        }
      } else {
        // Legacy fallback: use primary applicant if no personId provided
        targetPerson = people.find(p => p.role === 'applicant');
        if (!targetPerson) {
          return res.status(400).json({ message: "No primary applicant found" });
        }
      }

      // SAFETY GUARDRAIL: Only allow screening for completed applications (signed with disclosure)
      if (!targetPerson.isCompleted) {
        return res.status(400).json({ message: "Cannot request screening until the applicant completes and signs their application" });
      }

      // Check if screening already exists for this person - allow retry for failed, not_sent, or sent (resend invitation)
      const existingOrder = await storage.getRentalScreeningOrderByPerson(targetPerson.id);
      const allowedRetryStatuses = ['error', 'not_sent', 'sent'];
      if (existingOrder && !allowedRetryStatuses.includes(existingOrder.status)) {
        return res.status(400).json({ message: `Screening already requested for ${targetPerson.firstName} ${targetPerson.lastName}` });
      }
      
      // If there's a failed or stuck order for this person (error/not_sent), delete it so we can send a fresh invitation
      // For 'sent' orders, we also delete and recreate since Western Verify AppScreen generates a new invitation each time
      if (existingOrder && allowedRetryStatuses.includes(existingOrder.status)) {
        await storage.deleteRentalScreeningOrder(existingOrder.id);
      }

      const formData = targetPerson.formJson as Record<string, any>;
      
      // Import DigitalDelve service and crypto
      const { processScreeningRequest } = await import("../digitalDelveService");
      const { decryptCredentials } = await import("../crypto");
      
      // Determine base URL for webhooks - use stable production domain
      // IMPORTANT: Use REPLIT_DOMAINS for consistent webhook URLs that Western Verify can reach
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : `${req.headers['x-forwarded-proto'] || req.protocol || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
      
      // Resolve landlord's screening credentials if configured
      let screeningCredentials: { username: string; password: string; invitationId?: string } | undefined;
      const landlordCreds = await storage.getLandlordScreeningCredentials(userId);
      if (landlordCreds && landlordCreds.status === 'verified') {
        try {
          const decrypted = decryptCredentials({
            encryptedUsername: landlordCreds.encryptedUsername,
            encryptedPassword: landlordCreds.encryptedPassword,
            encryptionIv: landlordCreds.encryptionIv,
          });
          // Resolve per-property invitation ID override: submission → application_link → unit → property
          let resolvedInvitationId = landlordCreds.defaultInvitationId || undefined;
          try {
            const propertyRow = await db.execute(sql`
              SELECT rp.screening_invitation_id
              FROM rental_submissions rs
              JOIN rental_application_links ral ON rs.application_link_id = ral.id
              JOIN rental_units ru ON ral.unit_id = ru.id
              JOIN rental_properties rp ON ru.property_id = rp.id
              WHERE rs.id = ${submission.id}
              LIMIT 1
            `);
            const propInvId = propertyRow.rows[0]?.screening_invitation_id as string | null | undefined;
            if (propInvId) {
              resolvedInvitationId = propInvId;
              console.log(`[Screening] Using per-property invitation ID for submission ${submission.id}`);
            }
          } catch (propErr) {
            console.error("[Screening] Failed to resolve property invitation ID, using account default:", propErr);
          }
          screeningCredentials = {
            username: decrypted.username,
            password: decrypted.password,
            invitationId: resolvedInvitationId,
          };
        } catch (e) {
          console.error("Failed to decrypt landlord credentials, falling back to system credentials");
        }
      }
      
      const result = await processScreeningRequest(
        submission.id,
        {
          firstName: targetPerson.firstName || "",
          lastName: targetPerson.lastName || "",
          email: targetPerson.email || "",
          phone: targetPerson.phone || formData.phone,
          ssn: formData.ssn,
          dob: formData.dob,
          address: formData.currentAddress,
          city: formData.currentCity,
          state: formData.currentState,
          zip: formData.currentZip,
        },
        baseUrl,
        invitationId,
        screeningCredentials,
        targetPerson.id
      );

      if (result.success) {
        // Auto-update submission status based on screening progress
        await updateSubmissionStatusFromScreening(submission.id);
        
        // Log event with personId
        await storage.logRentalApplicationEvent({
          submissionId: submission.id,
          eventType: 'screening_requested',
          metadataJson: { orderId: result.order?.id, personId: targetPerson.id, personName: `${targetPerson.firstName} ${targetPerson.lastName}` },
        });
        
        // Track analytics event for dashboard
        await storage.trackEvent({
          userId,
          eventType: 'screening_request',
          eventData: { submissionId: submission.id, personId: targetPerson.id, personName: `${targetPerson.firstName} ${targetPerson.lastName}` },
        });
        
        res.json({ success: true, order: result.order });
      } else {
        console.error("Screening request failed:", result.error);
        res.status(500).json({ message: result.error || "Failed to request screening" });
      }
    } catch (error: any) {
      console.error("Error requesting screening:", error?.message || error);
      console.error("Stack:", error?.stack);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Redirect to Western Verify report lookup page
  // NOTE: Full SSO auto-login is not possible without exposing credentials to the browser.
  // Western Verify's SSO requires browser-based form submission to set session cookies.
  // For security, we redirect landlords to the report lookup page where they can log in.
  app.get('/api/rental/screening/:orderId/view-report', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { orderId } = req.params;

      // Get the screening order to verify it exists
      const order = await storage.getRentalScreeningOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Screening order not found" });
      }

      // Verify ownership via submission
      const submission = await storage.getRentalSubmission(order.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Redirect to Western Verify report lookup page
      res.redirect('https://secure.westernverify.com/report_lookup.cfm');
    } catch (error: any) {
      console.error("Error redirecting to report:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Resend invitation email to incomplete co-applicant/guarantor
  app.post('/api/rental/submissions/:submissionId/people/:personId/resend-invite', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { submissionId, personId } = req.params;

      // Get and verify submission ownership
      const submission = await storage.getRentalSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns this submission
      const appLink = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the person
      const people = await storage.getRentalSubmissionPeople(submissionId);
      const person = people.find(p => p.id === personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Check person is incomplete
      if (person.isCompleted) {
        return res.status(400).json({ message: "This person has already completed their application" });
      }

      // Build the invite URL
      const inviteUrl = `/apply/person/${person.inviteToken}`;
      const propertyName = property.name + (unit.unitLabel ? ` - ${unit.unitLabel}` : '');

      // Find the primary applicant for the "invited by" info
      const primaryApplicant = people.find(p => p.role === 'applicant' && p.isCompleted);

      // Get landlord info for email
      const landlord = await storage.getUser(userId);
      const landlordEmailInfo = landlord ? {
        businessName: landlord.businessName || undefined,
        phoneNumber: landlord.phoneNumber || undefined,
      } : undefined;

      // Send the invite email
      await emailService.sendCoApplicantInviteEmail(
        { email: person.email || '', firstName: person.firstName || '', lastName: person.lastName || '' },
        { firstName: primaryApplicant?.firstName || 'Applicant', lastName: primaryApplicant?.lastName || '' },
        propertyName,
        inviteUrl,
        person.role as 'coapplicant' | 'guarantor',
        landlordEmailInfo
      );

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId,
        eventType: 'invitation_resent',
        metadataJson: { personId, email: person.email, role: person.role },
      });

      console.log(`✅ Resent invitation to ${person.email} for submission ${submissionId}`);
      res.json({ success: true, message: "Invitation resent successfully" });
    } catch (error: any) {
      console.error("Error resending invitation:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Delete a co-applicant or guarantor from submission
  app.delete('/api/rental/submissions/:submissionId/people/:personId', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { submissionId, personId } = req.params;

      // Get and verify submission ownership
      const submission = await storage.getRentalSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Verify landlord owns this submission
      const appLink = await storage.getRentalApplicationLink(submission.applicationLinkId);
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the person
      const people = await storage.getRentalSubmissionPeople(submissionId);
      const person = people.find(p => p.id === personId);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      // Cannot delete the primary applicant
      if (person.role === 'applicant') {
        return res.status(400).json({ message: "Cannot delete the primary applicant. Delete the entire submission instead." });
      }

      // Delete the person
      await storage.deleteRentalSubmissionPerson(personId);

      // Log event
      await storage.logRentalApplicationEvent({
        submissionId,
        eventType: 'person_removed',
        metadataJson: { 
          personId, 
          personName: `${person.firstName} ${person.lastName}`,
          role: person.role,
          removedBy: userId 
        },
      });

      console.log(`✅ Deleted person ${personId} from submission ${submissionId}`);
      res.json({ success: true, message: "Person removed successfully" });
    } catch (error: any) {
      console.error("Error deleting person:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Get available screening invitations (packages) - uses landlord's own credentials
  app.get('/api/rental/screening/invitations', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { retrieveInvitations } = await import("../digitalDelveService");
      const { decryptCredentials } = await import("../crypto");
      const landlordCreds = await storage.getLandlordScreeningCredentials(userId);
      let credentialsToUse: { username: string; password: string } | undefined;
      if (landlordCreds && landlordCreds.status === 'verified') {
        try {
          const decrypted = decryptCredentials({
            encryptedUsername: landlordCreds.encryptedUsername,
            encryptedPassword: landlordCreds.encryptedPassword,
            encryptionIv: landlordCreds.encryptionIv,
          });
          credentialsToUse = { username: decrypted.username, password: decrypted.password };
        } catch (e) {
          // fall through to system creds
        }
      }
      const result = await retrieveInvitations(credentialsToUse);
      if (result.success) {
        res.json(result.invitations || []);
      } else {
        res.status(500).json({ message: result.error || "Failed to retrieve invitations" });
      }
    } catch (error) {
      console.error("Error getting screening invitations:", error);
      res.status(500).json({ message: "Failed to get screening invitations" });
    }
  });

  // Verify DigitalDelve credentials
  app.post('/api/rental/screening/verify', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const { verifyCredentials } = await import("../digitalDelveService");
      const result = await verifyCredentials();
      
      res.json({ success: result.success, error: result.error });
    } catch (error: any) {
      console.error("Error verifying credentials:", error);
      res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
    }
  });

  // Get SSO URL to view report - by submissionId
  app.get('/api/rental/submissions/:submissionId/screening/report-url', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Get the order by submissionId
      const order = await storage.getRentalScreeningOrder(req.params.submissionId);
      if (!order) {
        return res.status(404).json({ message: "Screening order not found" });
      }

      // Verify ownership via submission
      const submission = await storage.getRentalSubmission(order.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Direct to Western Verify login page for compliance
      res.json({ url: 'https://secure.westernverify.com/login.cfm' });
    } catch (error) {
      console.error("Error getting report URL:", error);
      res.status(500).json({ message: "Failed to get report URL" });
    }
  });

  // Get SSO URL to view report (by orderId - for per-person screening)
  app.get('/api/rental/screening/:orderId/report-url', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Get the order by its ID
      const order = await storage.getRentalScreeningOrderById(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Screening order not found" });
      }

      // Verify ownership via submission
      const submission = await storage.getRentalSubmission(order.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Direct to Western Verify login page for compliance
      res.json({ url: 'https://secure.westernverify.com/login.cfm' });
    } catch (error) {
      console.error("Error getting report URL:", error);
      res.status(500).json({ message: "Failed to get report URL" });
    }
  });

  // Sync screening status by checking if report is available
  // This is useful when webhooks are missed or delayed
  // Manual override: landlord marks a stuck screening as complete after
  // verifying directly on Western Verify. Used when the result webhook
  // never arrived (network issue, secret mismatch at the time, etc.).
  app.post('/api/rental/screening/:orderId/mark-complete', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const order = await storage.getRentalScreeningOrderById(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: 'Screening order not found' });
      }

      // Authorize: caller must own the property tied to this submission.
      const submission = await storage.getRentalSubmission(order.submissionId);
      if (!submission) return res.status(404).json({ message: 'Submission not found' });
      const appLink = submission.applicationLinkId
        ? await storage.getRentalApplicationLink(submission.applicationLinkId)
        : null;
      if (!appLink) return res.status(404).json({ message: 'Application link not found' });
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) return res.status(404).json({ message: 'Unit not found' });
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) return res.status(403).json({ message: 'Access denied' });

      if (order.status === 'complete') {
        return res.json({ success: true, status: 'complete', alreadyComplete: true });
      }

      const updated = await storage.updateRentalScreeningOrder(order.id, {
        status: 'complete',
      });
      console.log(`[Screening] Manual mark-complete by ${userId} for order ${order.id}`);
      return res.json({ success: true, status: 'complete', order: updated });
    } catch (error: any) {
      console.error('Error marking screening complete:', error);
      res.status(500).json({ message: 'Failed to mark complete' });
    }
  });

  app.post('/api/rental/screening/:orderId/sync', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      const order = await storage.getRentalScreeningOrderById(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Screening order not found" });
      }

      const submission = await storage.getRentalSubmission(order.submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
      if (!appLink) {
        return res.status(404).json({ message: "Application link not found" });
      }
      const unit = await storage.getRentalUnit(appLink.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await storage.getRentalProperty(unit.propertyId, userId);
      if (!property) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get credentials for sync
      const storedCredentials = await storage.getLandlordScreeningCredentials(userId);
      if (!storedCredentials || !storedCredentials.encryptedUsername || !storedCredentials.encryptedPassword) {
        return res.status(400).json({ message: "Screening credentials not configured" });
      }

      // Decrypt credentials before using
      const { decryptCredentials } = await import("../crypto");
      let credentials;
      try {
        const decrypted = decryptCredentials({
          encryptedUsername: storedCredentials.encryptedUsername,
          encryptedPassword: storedCredentials.encryptedPassword,
          encryptionIv: storedCredentials.encryptionIv,
        });
        credentials = {
          username: decrypted.username,
          password: decrypted.password,
        };
      } catch (e) {
        console.error("Failed to decrypt credentials:", e);
        return res.status(400).json({ message: "Failed to decrypt credentials" });
      }

      const { syncScreeningStatus } = await import("../digitalDelveService");
      const result = await syncScreeningStatus(req.params.orderId, credentials);

      res.json(result);
    } catch (error) {
      console.error("Error syncing screening status:", error);
      res.status(500).json({ message: "Failed to sync status" });
    }
  });

  // Bulk sync all pending screenings for the current user
  app.post('/api/rental/screening/bulk-sync', isAuthenticated, requireAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      const storedCredentials = await storage.getLandlordScreeningCredentials(userId);
      if (!storedCredentials || !storedCredentials.encryptedUsername || !storedCredentials.encryptedPassword) {
        return res.json({ synced: 0, completed: 0, errors: 0, message: 'no_credentials' });
      }

      const { decryptCredentials } = await import("../crypto");
      let credentials;
      try {
        const decrypted = decryptCredentials({
          encryptedUsername: storedCredentials.encryptedUsername,
          encryptedPassword: storedCredentials.encryptedPassword,
          encryptionIv: storedCredentials.encryptionIv,
        });
        credentials = { username: decrypted.username, password: decrypted.password };
      } catch (e) {
        return res.json({ synced: 0, completed: 0, errors: 0, message: 'credential_error' });
      }

      const { bulkSyncScreeningStatuses } = await import("../digitalDelveService");
      const result = await bulkSyncScreeningStatuses(userId, credentials);
      
      res.json(result);
    } catch (error) {
      console.error("Error in bulk screening sync:", error);
      res.status(500).json({ message: "Failed to sync screening statuses" });
    }
  });
}
