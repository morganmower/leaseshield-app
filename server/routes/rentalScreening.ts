import type { Express } from "express";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { execSync } from "child_process";
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

      // Generate PDF using Puppeteer with system Chromium
      const puppeteer = await import('puppeteer');
      const chromiumPath = execSync('which chromium').toString().trim();
      const browser = await puppeteer.default.launch({ 
        headless: true,
        executablePath: chromiumPath,
        timeout: 30000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--disable-extensions',
          '--disable-background-networking',
        ]
      });
      
      let pdfBuffer: Buffer;
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);

        const consentDate = person.fcraAuthorizedTimestamp 
          ? new Date(person.fcraAuthorizedTimestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZoneName: 'short'
          })
        : 'Unknown';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Georgia', serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              line-height: 1.6;
              color: #1a1a1a;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #0d9488;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #0d9488;
              margin: 0 0 10px 0;
              font-size: 24px;
            }
            .header h2 {
              color: #374151;
              margin: 0;
              font-size: 18px;
              font-weight: normal;
            }
            .section {
              margin-bottom: 24px;
            }
            .section-title {
              font-weight: bold;
              color: #0d9488;
              margin-bottom: 8px;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 24px;
            }
            .info-item label {
              display: block;
              font-size: 11px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-item span {
              font-size: 14px;
            }
            .consent-box {
              background: #f0fdfa;
              border: 1px solid #99f6e4;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
            }
            .consent-box h3 {
              color: #0d9488;
              margin: 0 0 12px 0;
              font-size: 16px;
            }
            .consent-text {
              font-size: 13px;
              color: #374151;
            }
            .consent-text ul {
              margin: 12px 0;
              padding-left: 24px;
            }
            .consent-text li {
              margin-bottom: 8px;
            }
            .authorization-stamp {
              background: #dcfce7;
              border: 2px solid #22c55e;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 24px 0;
            }
            .authorization-stamp .checkmark {
              color: #22c55e;
              font-size: 36px;
              margin-bottom: 8px;
            }
            .authorization-stamp .status {
              color: #166534;
              font-weight: bold;
              font-size: 18px;
            }
            .authorization-stamp .timestamp {
              color: #374151;
              font-size: 14px;
              margin-top: 8px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 11px;
              color: #6b7280;
              text-align: center;
            }
            .disclaimer {
              background: #fffbeb;
              border: 1px solid #fcd34d;
              border-radius: 6px;
              padding: 12px;
              font-size: 11px;
              color: #92400e;
              margin-top: 24px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Background Check Authorization</h1>
            <h2>Rental Application Consent Record</h2>
          </div>

          <div class="section">
            <div class="section-title">Applicant Information</div>
            <div class="info-grid">
              <div class="info-item">
                <label>Full Name</label>
                <span>${person.firstName} ${person.lastName}</span>
              </div>
              <div class="info-item">
                <label>Email Address</label>
                <span>${person.email}</span>
              </div>
              <div class="info-item">
                <label>Role</label>
                <span>${person.role === 'applicant' ? 'Primary Applicant' : person.role === 'coapplicant' ? 'Co-Applicant' : 'Guarantor'}</span>
              </div>
              <div class="info-item">
                <label>Application Date</label>
                <span>${new Date(person.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Property Information</div>
            <div class="info-grid">
              <div class="info-item">
                <label>Property</label>
                <span>${property.name}</span>
              </div>
              <div class="info-item">
                <label>Unit</label>
                <span>${unit.unitLabel}</span>
              </div>
            </div>
          </div>

          <div class="consent-box">
            <h3>Disclosure Acknowledgment</h3>
            <div class="consent-text">
              <p>By submitting this rental application, the applicant acknowledged the following:</p>
              <ul>
                <li>A background screening may be requested in connection with the rental application</li>
                <li>The screening authorization will be collected directly by Western Verify through its screening platform DigitalDelve</li>
                <li>LeaseShield does not make rental decisions</li>
                <li>The background screening report may include credit history, rental history, employment-related information, criminal records, and eviction records as permitted by law</li>
              </ul>
              <p>The applicant authorized the verification of the information provided, including background and credit screening where permitted by law.</p>
            </div>
          </div>

          <div class="authorization-stamp">
            <div class="checkmark">✓</div>
            <div class="status">AUTHORIZED</div>
            <div class="timestamp">Consent recorded: ${consentDate}</div>
            ${(person.formJson as any)?.typedSignature ? `
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed #86efac;">
                <div style="font-size: 12px; color: #374151; margin-bottom: 8px;">Electronic Signature:</div>
                <div style="font-family: 'Georgia', serif; font-style: italic; font-size: 20px; color: #166534;">${(person.formJson as any).typedSignature}</div>
              </div>
            ` : ''}
          </div>

          <div class="disclaimer">
            <strong>Important:</strong> This document serves as a record that the applicant acknowledged the background screening disclosure and authorized verification of their information during the rental application process. The actual background check authorization and consent are collected separately by Western Verify (DigitalDelve) in compliance with FCRA requirements.
          </div>

          <div class="footer">
            <p>Generated by LeaseShield on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>Submission ID: ${submission.id}</p>
          </div>
        </body>
        </html>
      `;

        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        const pdfData = await page.pdf({
          format: 'Letter',
          printBackground: true,
          margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
        });
        
        pdfBuffer = Buffer.from(pdfData);
      } finally {
        await browser.close();
      }

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

      // Helper functions
      const escapeHtml = (str: string | null | undefined): string => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      };

      const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      };

      const roleLabel = (role: string): string => {
        switch (role) {
          case 'applicant': return 'Primary Applicant';
          case 'coapplicant': return 'Co-Applicant';
          case 'guarantor': return 'Guarantor';
          default: return role;
        }
      };

      // Generate terms & policies section from cover page
      const generateTermsPoliciesSection = (link: any) => {
        const merged = link.mergedSchemaJson as any;
        const propertyTerms = merged?.propertyTerms || {};
        const coverPage = merged?.coverPage || {};
        const sections = coverPage?.sections || [];
        
        // Check if there's anything to show
        const hasPropertyTerms = propertyTerms.monthlyRent || propertyTerms.applicationFee || 
          propertyTerms.securityDeposit || propertyTerms.adminFee || propertyTerms.additionalNotes;
        const hasSections = sections.length > 0;
        
        if (!hasPropertyTerms && !hasSections) {
          return '';
        }
        
        let html = `<div class="terms-section">`;
        
        // Property Terms (rent, fees, deposits)
        if (hasPropertyTerms) {
          html += `
            <div class="property-terms">
              <h3>Property Terms &amp; Fees</h3>
              <div class="terms-grid">
                ${propertyTerms.monthlyRent ? `<div class="term-item"><label>Monthly Rent</label><span>${escapeHtml(propertyTerms.monthlyRent)}</span></div>` : ''}
                ${propertyTerms.applicationFee ? `<div class="term-item"><label>Application Fee</label><span>${escapeHtml(propertyTerms.applicationFee)}</span></div>` : ''}
                ${propertyTerms.securityDeposit ? `<div class="term-item"><label>Security Deposit</label><span>${escapeHtml(propertyTerms.securityDeposit)}</span></div>` : ''}
                ${propertyTerms.adminFee ? `<div class="term-item"><label>Admin/Move-in Fee</label><span>${escapeHtml(propertyTerms.adminFee)}</span></div>` : ''}
                ${propertyTerms.leaseSignDeadlineHours ? `<div class="term-item"><label>Lease Signing Deadline</label><span>${propertyTerms.leaseSignDeadlineHours} hours after approval</span></div>` : ''}
              </div>
              ${propertyTerms.additionalNotes ? `<div class="additional-notes"><label>Additional Notes</label><p>${escapeHtml(propertyTerms.additionalNotes)}</p></div>` : ''}
            </div>
          `;
        }
        
        // Cover Page Policies
        if (hasSections) {
          html += `
            <div class="policies-section">
              <h3>Application Requirements &amp; Policies</h3>
              ${sections.map((section: any) => `
                <div class="policy-item">
                  <strong>${escapeHtml(section.heading || '')}</strong>
                  <p>${escapeHtml(section.body || '')}</p>
                </div>
              `).join('')}
            </div>
          `;
        }
        
        html += `</div>`;
        return html;
      };

      // Generate acknowledgment record section
      const generateAcknowledgmentSection = (personList: any[]) => {
        const acknowledgedPeople = personList.filter(p => p.propertyTermsAcknowledgedAt);
        
        if (acknowledgedPeople.length === 0) {
          return '';
        }
        
        return `
          <div class="acknowledgment-section">
            <h3>Acknowledgment Record</h3>
            <p class="ack-intro">The following individuals acknowledged the property terms, fees, and application requirements shown above:</p>
            <div class="ack-list">
              ${acknowledgedPeople.map(person => `
                <div class="ack-item">
                  <span class="checkmark">&#10003;</span>
                  <span><strong>${escapeHtml(person.firstName)} ${escapeHtml(person.lastName)}</strong> (${roleLabel(person.role)}) acknowledged on ${formatDate(person.propertyTermsAcknowledgedAt)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      };

      // Generate person sections
      const generatePersonSection = (person: any, index: number) => {
        const formData = person.formJson || {};
        
        return `
          <div class="person-section ${index > 0 ? 'page-break' : ''}">
            <div class="person-header">
              <h2>${escapeHtml(person.firstName)} ${escapeHtml(person.lastName)}</h2>
              <span class="role-badge">${roleLabel(person.role)}</span>
            </div>
            
            <div class="info-section">
              <h3>Contact Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <label>Email</label>
                  <span>${escapeHtml(person.email)}</span>
                </div>
                ${formData.phone ? `
                <div class="info-item">
                  <label>Phone</label>
                  <span>${escapeHtml(formData.phone)}</span>
                </div>
                ` : ''}
                ${formData.dateOfBirth ? `
                <div class="info-item">
                  <label>Date of Birth</label>
                  <span>${escapeHtml(formData.dateOfBirth)}</span>
                </div>
                ` : ''}
                ${formData.driversLicense ? `
                <div class="info-item">
                  <label>Driver's License</label>
                  <span>${escapeHtml(formData.driversLicense)}</span>
                </div>
                ` : ''}
                ${formData.desiredMoveInDate ? `
                <div class="info-item">
                  <label>Desired Move-in</label>
                  <span>${formatDate(formData.desiredMoveInDate)}</span>
                </div>
                ` : ''}
                ${formData.hasHousingVoucher !== undefined ? `
                <div class="info-item">
                  <label>Housing Voucher</label>
                  <span>${formData.hasHousingVoucher ? `Yes${formData.voucherType ? ` - ${escapeHtml(formData.voucherType)}` : ''}` : 'No'}</span>
                </div>
                ` : ''}
                ${formData.referralSource ? `
                <div class="info-item">
                  <label>Referral Source</label>
                  <span>${escapeHtml(formData.referralSource === 'other' ? formData.referralSourceOther || 'Other' : formData.referralSource.replace(/_/g, ' '))}</span>
                </div>
                ` : ''}
              </div>
            </div>

            ${formData.occupants && Array.isArray(formData.occupants) && formData.occupants.length > 0 ? `
            <div class="info-section">
              <h3>Additional Occupants</h3>
              <div class="occupants-list">
                ${formData.occupants.map((occ: any, idx: number) => `
                  <div class="occupant-item">
                    <strong>${escapeHtml(occ.name || 'Occupant ' + (idx + 1))}</strong>
                    ${occ.relationship ? ` - ${escapeHtml(occ.relationship)}` : ''}
                    ${occ.age ? ` (Age: ${escapeHtml(occ.age)})` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            ${formData.currentAddress ? `
            <div class="info-section">
              <h3>Current Residence</h3>
              <div class="info-grid">
                <div class="info-item wide">
                  <label>Address</label>
                  <span>${escapeHtml(formData.currentAddress)}${formData.currentCity ? `, ${escapeHtml(formData.currentCity)}` : ''}${formData.currentState ? `, ${escapeHtml(formData.currentState)}` : ''} ${escapeHtml(formData.currentZip || '')}</span>
                </div>
                ${formData.currentLandlordName ? `
                <div class="info-item">
                  <label>Landlord Name</label>
                  <span>${escapeHtml(formData.currentLandlordName)}</span>
                </div>
                ` : ''}
                ${formData.currentLandlordPhone ? `
                <div class="info-item">
                  <label>Landlord Phone</label>
                  <span>${escapeHtml(formData.currentLandlordPhone)}</span>
                </div>
                ` : ''}
                ${formData.currentRent ? `
                <div class="info-item">
                  <label>Current Rent</label>
                  <span>$${escapeHtml(formData.currentRent)}/mo</span>
                </div>
                ` : ''}
                ${formData.moveInDate ? `
                <div class="info-item">
                  <label>Move-In Date</label>
                  <span>${escapeHtml(formData.moveInDate)}</span>
                </div>
                ` : ''}
                ${formData.reasonForMoving ? `
                <div class="info-item wide">
                  <label>Reason for Moving</label>
                  <span>${escapeHtml(formData.reasonForMoving)}</span>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            ${formData.currentEmployer || formData.monthlyIncome ? `
            <div class="info-section">
              <h3>Employment &amp; Income</h3>
              <div class="info-grid">
                ${formData.currentEmployer ? `
                <div class="info-item">
                  <label>Employer</label>
                  <span>${escapeHtml(formData.currentEmployer)}</span>
                </div>
                ` : ''}
                ${formData.employerPhone ? `
                <div class="info-item">
                  <label>Employer Phone</label>
                  <span>${escapeHtml(formData.employerPhone)}</span>
                </div>
                ` : ''}
                ${formData.jobTitle ? `
                <div class="info-item">
                  <label>Job Title</label>
                  <span>${escapeHtml(formData.jobTitle)}</span>
                </div>
                ` : ''}
                ${formData.monthlyIncome ? `
                <div class="info-item">
                  <label>Monthly Income</label>
                  <span>$${escapeHtml(formData.monthlyIncome)}</span>
                </div>
                ` : ''}
                ${formData.employmentLength ? `
                <div class="info-item">
                  <label>Time at Job</label>
                  <span>${escapeHtml(formData.employmentLength)}</span>
                </div>
                ` : ''}
                ${formData.additionalIncome ? `
                <div class="info-item">
                  <label>Additional Income</label>
                  <span>$${escapeHtml(formData.additionalIncome)} (${escapeHtml(formData.additionalIncomeSource || 'Other')})</span>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            ${formData.emergencyContactName || formData.emergencyContactPhone ? `
            <div class="info-section">
              <h3>Emergency Contact</h3>
              <div class="info-grid">
                ${formData.emergencyContactName ? `
                <div class="info-item">
                  <label>Name</label>
                  <span>${escapeHtml(formData.emergencyContactName)}</span>
                </div>
                ` : ''}
                ${formData.emergencyContactPhone ? `
                <div class="info-item">
                  <label>Phone</label>
                  <span>${escapeHtml(formData.emergencyContactPhone)}</span>
                </div>
                ` : ''}
                ${formData.emergencyContactRelationship ? `
                <div class="info-item">
                  <label>Relationship</label>
                  <span>${escapeHtml(formData.emergencyContactRelationship)}</span>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}

            ${formData.personalReferences && Array.isArray(formData.personalReferences) && formData.personalReferences.length > 0 ? `
            <div class="info-section">
              <h3>Personal References</h3>
              <div class="references-list">
                ${formData.personalReferences.map((ref: any, idx: number) => `
                  <div class="reference-item">
                    <strong>${escapeHtml(ref.name || 'Reference ' + (idx + 1))}</strong>
                    ${ref.relationship ? ` (${escapeHtml(ref.relationship)})` : ''}
                    <div class="reference-contact">
                      ${ref.phone ? `<span>Phone: ${escapeHtml(ref.phone)}</span>` : ''}
                      ${ref.email ? `<span>Email: ${escapeHtml(ref.email)}</span>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            ${formData.hasPets !== undefined || formData.smoker !== undefined || formData.hasBeenEvicted !== undefined || formData.hasFelony !== undefined ? `
            <div class="info-section">
              <h3>Additional Information</h3>
              <div class="info-grid">
                ${formData.hasPets !== undefined ? `
                <div class="info-item">
                  <label>Has Pets</label>
                  <span>${formData.hasPets ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
                ${formData.smoker !== undefined ? `
                <div class="info-item">
                  <label>Smoker</label>
                  <span>${formData.smoker ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
                ${formData.hasBeenEvicted !== undefined ? `
                <div class="info-item">
                  <label>Prior Eviction</label>
                  <span>${formData.hasBeenEvicted ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
                ${formData.hasFelony !== undefined ? `
                <div class="info-item">
                  <label>Felony Conviction</label>
                  <span>${formData.hasFelony ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
                ${(formData.smokesOrVapes !== undefined || formData.smoker !== undefined) ? `
                <div class="info-item">
                  <label>Smokes/Vapes</label>
                  <span>${(formData.smokesOrVapes ?? formData.smoker) ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
              </div>
              ${formData.pets && Array.isArray(formData.pets) && formData.pets.length > 0 ? `
              <div class="pets-list">
                <label>Pets:</label>
                <ul>
                  ${formData.pets.map((p: any) => `<li>${escapeHtml(p.type || '')} ${p.breed ? `(${escapeHtml(p.breed)})` : ''} ${p.weight ? `- ${escapeHtml(p.weight)} lbs` : ''} ${p.isServiceAnimal ? '- Service Animal' : ''}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
              ${formData.vehicles && Array.isArray(formData.vehicles) && formData.vehicles.length > 0 ? `
              <div class="vehicles-list">
                <label>Vehicles:</label>
                <ul>
                  ${formData.vehicles.map((v: any) => `<li>${escapeHtml(v.year || '')} ${escapeHtml(v.make || '')} ${escapeHtml(v.model || '')} ${v.color ? `(${escapeHtml(v.color)})` : ''} ${v.licensePlate ? `- ${escapeHtml(v.licensePlate)}` : ''}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
            </div>
            ` : ''}

            ${person.fcraAuthorized ? `
            <div class="fcra-authorization-box">
              <div class="fcra-header">
                <span class="checkmark">&#10003;</span>
                <span class="fcra-title">Background Screening Disclosure &amp; Acknowledgment</span>
                <span class="fcra-date">Acknowledged: ${formatDate(person.fcraAuthorizedTimestamp)}</span>
              </div>
              <div class="fcra-content">
                <p>As part of the rental application process, the landlord or property manager may request a background screening report about you for housing purposes.</p>
                <p class="fcra-subheading">If screening is requested:</p>
                <ul>
                  <li>You will receive a separate invitation directly from Western Verify, the consumer reporting agency, delivered through its screening platform DigitalDelve</li>
                  <li>That invitation will include a standalone disclosure and authorization, which you must review and complete before any consumer report is obtained</li>
                  <li>LeaseShield does not collect or store your Social Security number, date of birth, or screening authorization</li>
                </ul>
                <p>The background screening report, if obtained, may include information permitted by law, such as credit history, rental history, employment-related information, criminal records, and eviction records.</p>
                <p class="fcra-subheading">Adverse Action Notice:</p>
                <p>If adverse action is taken based in whole or in part on information contained in a consumer report, you will be provided an adverse action notice that includes:</p>
                <ul>
                  <li>The name, address, and phone number of the consumer reporting agency (Western Verify) that provided the report</li>
                  <li>A statement that the consumer reporting agency did not make the decision and cannot explain why the decision was made</li>
                  <li>Notice of your rights under the Fair Credit Reporting Act (FCRA), including your right to obtain a free copy of your consumer report and to dispute inaccurate or incomplete information</li>
                </ul>
                <p class="fcra-subheading">By acknowledging, applicant confirmed:</p>
                <ul>
                  <li>Understanding that a background screening may be requested in connection with the rental application</li>
                  <li>Understanding that any screening authorization will be collected directly by Western Verify, through its screening platform DigitalDelve, and not by LeaseShield</li>
                  <li>Understanding that LeaseShield does not make rental decisions</li>
                </ul>
              </div>
            </div>
            ` : `
            <div class="consent-status pending">
              <span>Background Check Authorization: Pending</span>
            </div>
            `}
          </div>
        `;
      };

      const primaryApplicant = people.find(p => p.role === 'applicant');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              max-width: 850px;
              margin: 0 auto;
              padding: 40px;
              line-height: 1.5;
              color: #1a1a1a;
              font-size: 12px;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #0d9488;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #0d9488;
              margin: 0 0 8px 0;
              font-size: 26px;
              font-weight: 600;
            }
            .header .subtitle {
              color: #6b7280;
              font-size: 14px;
            }
            .property-info {
              background: #f0fdfa;
              border: 1px solid #99f6e4;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 24px;
            }
            .property-info h3 {
              margin: 0 0 12px 0;
              color: #0d9488;
              font-size: 14px;
            }
            .property-info .details {
              display: flex;
              gap: 32px;
              flex-wrap: wrap;
            }
            .property-info .detail-item label {
              display: block;
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .property-info .detail-item span {
              font-size: 14px;
              font-weight: 500;
            }
            .person-section {
              margin-bottom: 32px;
              padding-bottom: 24px;
              border-bottom: 1px solid #e5e7eb;
            }
            .person-section:last-child {
              border-bottom: none;
            }
            .person-header {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
            }
            .person-header h2 {
              margin: 0;
              font-size: 18px;
              color: #1a1a1a;
            }
            .role-badge {
              background: #0d9488;
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 500;
            }
            .info-section {
              margin-bottom: 20px;
            }
            .info-section h3 {
              color: #374151;
              font-size: 13px;
              font-weight: 600;
              margin: 0 0 12px 0;
              padding-bottom: 6px;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
            }
            .info-item {
              padding: 8px;
              background: #f9fafb;
              border-radius: 4px;
            }
            .info-item.wide {
              grid-column: span 2;
            }
            .info-item label {
              display: block;
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .info-item span {
              font-size: 12px;
              color: #1a1a1a;
            }
            .consent-status {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 12px 16px;
              border-radius: 6px;
              font-size: 12px;
              margin-top: 16px;
            }
            .consent-status.authorized {
              background: #dcfce7;
              color: #166534;
            }
            .consent-status.pending {
              background: #fef3c7;
              color: #92400e;
            }
            .consent-status .checkmark {
              font-size: 16px;
              font-weight: bold;
            }
            .pets-list, .vehicles-list {
              margin-top: 12px;
            }
            .pets-list label, .vehicles-list label {
              display: block;
              font-size: 11px;
              color: #6b7280;
              margin-bottom: 4px;
            }
            .pets-list ul, .vehicles-list ul {
              margin: 0;
              padding-left: 20px;
            }
            .pets-list li, .vehicles-list li {
              font-size: 12px;
              margin-bottom: 4px;
            }
            .occupants-list, .references-list {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .occupant-item, .reference-item {
              padding: 8px 12px;
              background: #f9fafb;
              border-radius: 4px;
              font-size: 12px;
            }
            .reference-contact {
              display: flex;
              gap: 16px;
              margin-top: 4px;
              font-size: 11px;
              color: #6b7280;
            }
            .decision-box {
              margin-top: 32px;
              padding: 20px;
              border-radius: 8px;
            }
            .decision-box.approved {
              background: #dcfce7;
              border: 2px solid #22c55e;
            }
            .decision-box.denied {
              background: #fef2f2;
              border: 2px solid #ef4444;
            }
            .decision-box h3 {
              margin: 0 0 12px 0;
              font-size: 16px;
            }
            .decision-box.approved h3 { color: #166534; }
            .decision-box.denied h3 { color: #991b1b; }
            .decision-box p {
              margin: 4px 0;
              font-size: 12px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 10px;
              color: #9ca3af;
            }
            .terms-section {
              margin-bottom: 28px;
              padding: 16px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
            }
            .property-terms h3, .policies-section h3 {
              color: #0d9488;
              font-size: 14px;
              margin: 0 0 12px 0;
              padding-bottom: 6px;
              border-bottom: 1px solid #e5e7eb;
            }
            .terms-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 12px;
            }
            .term-item {
              padding: 8px;
              background: white;
              border-radius: 4px;
              border: 1px solid #e5e7eb;
            }
            .term-item label {
              display: block;
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .term-item span {
              font-size: 13px;
              font-weight: 500;
              color: #1a1a1a;
            }
            .additional-notes {
              margin-top: 8px;
              padding: 10px;
              background: white;
              border-radius: 4px;
              border: 1px solid #e5e7eb;
            }
            .additional-notes label {
              display: block;
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .additional-notes p {
              margin: 0;
              font-size: 12px;
              color: #1a1a1a;
            }
            .policies-section {
              margin-top: 16px;
            }
            .policy-item {
              margin-bottom: 10px;
              padding: 8px 10px;
              background: white;
              border-radius: 4px;
              border-left: 3px solid #0d9488;
            }
            .policy-item strong {
              display: block;
              font-size: 12px;
              color: #374151;
              margin-bottom: 3px;
            }
            .policy-item p {
              margin: 0;
              font-size: 11px;
              color: #6b7280;
              line-height: 1.4;
            }
            .acknowledgment-section {
              margin-top: 32px;
              padding: 16px;
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 8px;
            }
            .acknowledgment-section h3 {
              color: #166534;
              font-size: 14px;
              margin: 0 0 8px 0;
            }
            .ack-intro {
              font-size: 11px;
              color: #374151;
              margin: 0 0 12px 0;
            }
            .ack-list {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .ack-item {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 12px;
              background: white;
              border-radius: 4px;
              font-size: 12px;
            }
            .ack-item .checkmark {
              color: #22c55e;
              font-size: 16px;
              font-weight: bold;
            }
            .fcra-authorization-box {
              margin-top: 16px;
              background: #fef3c7;
              border: 1px solid #fcd34d;
              border-radius: 8px;
              padding: 12px 16px;
            }
            .fcra-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid #fcd34d;
              flex-wrap: wrap;
            }
            .fcra-header .checkmark {
              color: #16a34a;
              font-size: 18px;
              font-weight: bold;
            }
            .fcra-title {
              font-weight: 600;
              font-size: 13px;
              color: #92400e;
            }
            .fcra-date {
              margin-left: auto;
              font-size: 11px;
              color: #b45309;
              font-weight: 500;
            }
            .fcra-content {
              font-size: 10px;
              color: #78350f;
              line-height: 1.5;
            }
            .fcra-content p {
              margin: 6px 0;
            }
            .fcra-content ul {
              margin: 6px 0 10px 0;
              padding-left: 18px;
            }
            .fcra-content li {
              margin-bottom: 3px;
            }
            .fcra-subheading {
              font-weight: 600;
              margin-top: 10px !important;
            }
            .page-break {
              page-break-before: always;
            }
            @media print {
              body { padding: 20px; }
              .page-break { page-break-before: always; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Rental Application</h1>
            <div class="subtitle">Submitted ${formatDate(submission.createdAt)}</div>
          </div>

          <div class="property-info">
            <h3>Property Information</h3>
            <div class="details">
              <div class="detail-item">
                <label>Property</label>
                <span>${escapeHtml(property.name)}</span>
              </div>
              <div class="detail-item">
                <label>Unit</label>
                <span>${escapeHtml(unit.unitLabel)}</span>
              </div>
              <div class="detail-item">
                <label>Status</label>
                <span>${submission.status}</span>
              </div>
            </div>
          </div>

          ${generateTermsPoliciesSection(appLink)}

          ${people.map((person, index) => generatePersonSection(person, index)).join('')}

          ${decision ? `
          <div class="decision-box ${decision.decision}">
            <h3>Application ${decision.decision === 'approved' ? 'Approved' : 'Denied'}</h3>
            <p><strong>Decision Date:</strong> ${formatDate(decision.decidedAt)}</p>
            ${decision.notes ? `<p><strong>Notes:</strong> ${escapeHtml(decision.notes)}</p>` : ''}
          </div>
          ` : ''}

          ${generateAcknowledgmentSection(people)}

          <div class="footer">
            <p>Generated by LeaseShield on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            <p>Application ID: ${submission.id}</p>
          </div>
        </body>
        </html>
      `;

      // Generate PDF using Puppeteer
      const puppeteer = await import('puppeteer');
      const chromiumPath = execSync('which chromium').toString().trim();
      const browser = await puppeteer.default.launch({ 
        headless: true,
        executablePath: chromiumPath,
        timeout: 30000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--disable-extensions',
          '--disable-background-networking',
        ]
      });
      
      let pdfBuffer: Buffer;
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);

        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        const pdfData = await page.pdf({
          format: 'Letter',
          printBackground: true,
          margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
        });
        
        pdfBuffer = Buffer.from(pdfData);
      } finally {
        await browser.close();
      }

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
