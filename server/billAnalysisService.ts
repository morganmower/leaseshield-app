// AI-powered bill analysis using OpenAI to determine template relevance
import OpenAI from 'openai';
import type { LegislativeMonitoring, Template } from '@shared/schema';

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface BillAnalysisResult {
  relevanceLevel: 'high' | 'medium' | 'low' | 'dismissed';
  aiAnalysis: string;
  affectedTemplateIds: string[];
  affectedComplianceCategories: string[];
  recommendedChanges: string;
}

export class BillAnalysisService {
  /**
   * Analyze a bill to determine if it affects any templates
   */
  async analyzeBill(
    billTitle: string,
    billDescription: string,
    billText: string | null,
    stateId: string,
    templates: Template[]
  ): Promise<BillAnalysisResult> {
    try {
      // Filter templates to only those from the same state
      const stateTemplates = templates.filter(t => t.stateId === stateId && t.isActive);

      const templateList = stateTemplates
        .map(t => `- ${t.id}: ${t.title} (${t.templateType})`)
        .join('\n');

      const prompt = `You are a legal analyst specializing in landlord-tenant law. Analyze the following proposed legislation and determine:

1. How relevant is this bill to landlord-tenant law and rental property management?
2. Which specific templates (if any) would need to be updated if this bill becomes law?
3. Which compliance categories would be affected?
4. What changes would be required?

BILL INFORMATION:
Title: ${billTitle}
Description: ${billDescription}
${billText ? `\n\nFull Bill Text:\n${billText.substring(0, 10000)}` : ''}

AVAILABLE TEMPLATES FOR ${stateId}:
${templateList}

COMPLIANCE CATEGORIES TO CONSIDER:
- deposits: Security deposit limits, return timelines, deduction rules
- disclosures: Required landlord disclosures to tenants
- evictions: Eviction procedures, notice requirements, just cause
- fair_housing: Anti-discrimination, protected classes, accommodations
- rent_increases: Rent increase notice periods, rent control, caps on increases

Please respond in JSON format with:
{
  "relevanceLevel": "high" | "medium" | "low" | "dismissed",
  "analysis": "Brief explanation of why this bill matters or doesn't matter to landlords",
  "affectedTemplateIds": ["template-id-1", "template-id-2"],
  "affectedComplianceCategories": ["rent_increases", "deposits"],
  "recommendedChanges": "Specific changes needed to affected templates or compliance cards, or empty string if no changes needed"
}

Relevance Guidelines:
- HIGH: Directly changes landlord-tenant law, requires immediate template/compliance card updates
- MEDIUM: Related to rental housing, may affect templates or compliance indirectly
- LOW: Tangentially related to housing, unlikely to affect templates
- DISMISSED: Not related to landlord-tenant law at all

Be conservative - only mark as HIGH if templates or compliance cards definitely need updates.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a legal analyst specializing in landlord-tenant law. You help identify which legislation affects rental property templates.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(response);

      // Validate that mentioned template IDs actually exist
      const validTemplateIds = parsed.affectedTemplateIds.filter((id: string) =>
        stateTemplates.some(t => t.id === id)
      );

      // Validate compliance categories
      const validCategories = ['deposits', 'disclosures', 'evictions', 'fair_housing', 'rent_increases'];
      const validComplianceCategories = (parsed.affectedComplianceCategories || []).filter((cat: string) =>
        validCategories.includes(cat)
      );

      return {
        relevanceLevel: parsed.relevanceLevel,
        aiAnalysis: parsed.analysis,
        affectedTemplateIds: validTemplateIds,
        affectedComplianceCategories: validComplianceCategories,
        recommendedChanges: parsed.recommendedChanges || '',
      };
    } catch (error) {
      console.error('Error analyzing bill with AI:', error);
      
      // Fallback to basic keyword analysis if AI fails
      return this.fallbackAnalysis(billTitle, billDescription);
    }
  }

  /**
   * Fallback analysis if OpenAI fails
   */
  private fallbackAnalysis(billTitle: string, billDescription: string): BillAnalysisResult {
    const text = `${billTitle} ${billDescription}`.toLowerCase();
    
    // Keywords mapped to compliance categories
    const categoryKeywords: Record<string, string[]> = {
      rent_increases: [
        'rent increase', 'rent control', 'rent cap', 'rent stabilization',
        'rent limit', 'rental increase', 'rent notice', 'rent raise',
        'tenant protection act', 'just cause', 'rent regulation',
      ],
      deposits: [
        'security deposit', 'deposit return', 'deposit limit', 'deposit refund',
      ],
      evictions: [
        'eviction', 'unlawful detainer', 'lease termination', 'notice to quit',
        'eviction moratorium', 'eviction protection',
      ],
      disclosures: [
        'disclosure', 'lead paint', 'mold disclosure', 'bed bug',
      ],
      fair_housing: [
        'fair housing', 'discrimination', 'protected class', 'source of income',
        'housing discrimination', 'reasonable accommodation',
      ],
    };

    const highPriorityKeywords = [
      'eviction', 'security deposit', 'lease termination', 'notice requirement',
      'habitability', 'rent increase', 'rent control', 'rent cap', 'rent limit',
      'tenant protection', 'rent stabilization', 'just cause eviction',
    ];

    const mediumPriorityKeywords = [
      'landlord', 'tenant', 'rental', 'lease', 'housing',
    ];

    const hasHighPriority = highPriorityKeywords.some(k => text.includes(k));
    const hasMediumPriority = mediumPriorityKeywords.some(k => text.includes(k));

    // Determine affected compliance categories
    const affectedComplianceCategories: string[] = [];
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(k => text.includes(k))) {
        affectedComplianceCategories.push(category);
      }
    }

    if (hasHighPriority) {
      return {
        relevanceLevel: 'high',
        aiAnalysis: 'This bill contains keywords indicating it directly affects landlord-tenant law. Manual review required.',
        affectedTemplateIds: [],
        affectedComplianceCategories,
        recommendedChanges: 'Manual review needed to determine specific changes.',
      };
    } else if (hasMediumPriority) {
      return {
        relevanceLevel: 'medium',
        aiAnalysis: 'This bill may be related to landlord-tenant law. Review recommended.',
        affectedTemplateIds: [],
        affectedComplianceCategories,
        recommendedChanges: '',
      };
    } else {
      return {
        relevanceLevel: 'low',
        aiAnalysis: 'This bill does not appear to be directly related to landlord-tenant law.',
        affectedTemplateIds: [],
        affectedComplianceCategories: [],
        recommendedChanges: '',
      };
    }
  }

  /**
   * Generate updated template content based on legislative changes
   */
  async generateTemplateUpdate(
    template: Template,
    billTitle: string,
    billDescription: string,
    legislativeChanges: string
  ): Promise<{
    updatedTitle: string;
    updatedDescription: string;
    versionNotes: string;
    fillableFormData: any;
  }> {
    try {
      const prompt = `You are a legal document specialist. A new law has been passed that affects this landlord-tenant template.

CURRENT TEMPLATE:
Title: ${template.title}
Description: ${template.description}
Type: ${template.templateType}
State: ${template.stateId}

LEGISLATIVE CHANGE:
${billTitle}
${billDescription}

REQUIRED CHANGES:
${legislativeChanges}

Please generate:
1. Updated template title (if the change is significant enough to warrant it)
2. Updated description reflecting the new legal requirements
3. Version notes explaining what changed and why

Respond in JSON format:
{
  "updatedTitle": "Template title (same as original if no change needed)",
  "updatedDescription": "Updated description with new requirements",
  "versionNotes": "Clear explanation of what changed and why",
  "requiresFormUpdate": true/false
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a legal document specialist who updates landlord-tenant templates to comply with new legislation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(response);

      return {
        updatedTitle: parsed.updatedTitle,
        updatedDescription: parsed.updatedDescription,
        versionNotes: parsed.versionNotes,
        fillableFormData: template.fillableFormData, // Keep existing form structure
      };
    } catch (error) {
      console.error('Error generating template update:', error);
      throw error;
    }
  }

  /**
   * Analyze a court case to determine if it affects any templates
   */
  async analyzeCase(
    caseName: string,
    caseNameFull: string,
    opinionText: string | null,
    stateId: string,
    templates: Template[]
  ): Promise<BillAnalysisResult> {
    try {
      // Filter templates to only those from the same state
      const stateTemplates = templates.filter(t => t.stateId === stateId && t.isActive);

      const templateList = stateTemplates
        .map(t => `- ${t.id}: ${t.title} (${t.templateType})`)
        .join('\n');

      const prompt = `You are a legal analyst specializing in landlord-tenant law. Analyze the following court case and determine:

1. How relevant is this case to landlord-tenant law and rental property management?
2. Which specific templates (if any) would need to be updated based on this case decision?
3. What changes would be required to those templates to comply with this ruling?

CASE INFORMATION:
Name: ${caseName}
Full Name: ${caseNameFull}
${opinionText ? `\n\nCase Opinion (excerpt):\n${opinionText.substring(0, 8000)}` : ''}

AVAILABLE TEMPLATES FOR ${stateId}:
${templateList}

Please respond in JSON format with:
{
  "relevanceLevel": "high" | "medium" | "low" | "dismissed",
  "analysis": "Brief explanation of why this case matters or doesn't matter to landlords",
  "affectedTemplateIds": ["template-id-1", "template-id-2"],
  "recommendedChanges": "Specific changes needed to affected templates based on this ruling, or empty string if no changes needed"
}

Relevance Guidelines:
- HIGH: Case directly impacts landlord-tenant law, requires immediate template updates
- MEDIUM: Case related to rental housing, may affect templates indirectly
- LOW: Tangentially related to housing, unlikely to affect templates
- DISMISSED: Not related to landlord-tenant law at all

Be conservative - only mark as HIGH if templates definitely need updates.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a legal analyst specializing in landlord-tenant law. You help identify which court cases affect rental property templates.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(response);

      // Validate that mentioned template IDs actually exist
      const validTemplateIds = parsed.affectedTemplateIds.filter((id: string) =>
        stateTemplates.some(t => t.id === id)
      );

      // Validate compliance categories
      const validCategories = ['deposits', 'disclosures', 'evictions', 'fair_housing', 'rent_increases'];
      const validComplianceCategories = (parsed.affectedComplianceCategories || []).filter((cat: string) =>
        validCategories.includes(cat)
      );

      return {
        relevanceLevel: parsed.relevanceLevel,
        aiAnalysis: parsed.analysis,
        affectedTemplateIds: validTemplateIds,
        affectedComplianceCategories: validComplianceCategories,
        recommendedChanges: parsed.recommendedChanges || '',
      };
    } catch (error) {
      console.error('Error analyzing case with AI:', error);
      
      // Fallback to basic keyword analysis if AI fails
      return this.fallbackAnalysis(caseName, caseNameFull);
    }
  }

  /**
   * Analyze a bill to determine if it affects rental application compliance requirements
   * This is used to auto-generate new compliance rules when relevant legislation is detected
   */
  async analyzeApplicationImpact(
    billTitle: string,
    billDescription: string,
    billText: string | null,
    stateId: string
  ): Promise<{
    affectsApplications: boolean;
    complianceRuleType: 'acknowledgment' | 'disclosure' | 'authorization' | 'document_required' | 'link_required' | null;
    suggestedRuleKey: string | null;
    suggestedTitle: string | null;
    suggestedCheckboxLabel: string | null;
    suggestedDisclosureText: string | null;
    statuteReference: string | null;
    explanation: string;
  }> {
    try {
      const prompt = `You are a legal analyst specializing in landlord-tenant law. Analyze this proposed legislation to determine if it affects RENTAL APPLICATION REQUIREMENTS.

BILL INFORMATION:
State: ${stateId}
Title: ${billTitle}
Description: ${billDescription}
${billText ? `\n\nFull Bill Text:\n${billText.substring(0, 10000)}` : ''}

Specifically look for changes that would require landlords to:
1. Disclose new information to prospective tenants BEFORE accepting applications
2. Obtain new acknowledgments or authorizations from applicants
3. Require new documents during the application process
4. Provide links to new required information pages

Examples of application-impacting legislation:
- Tenant selection criteria disclosure requirements (like Texas Property Code § 92.3515)
- Background check authorization requirements
- Application fee disclosure rules
- Fair housing notice requirements
- Criminal history disclosure rules

Please respond in JSON format:
{
  "affectsApplications": true/false,
  "complianceRuleType": "acknowledgment" | "disclosure" | "authorization" | "document_required" | "link_required" | null,
  "suggestedRuleKey": "snake_case_unique_key_for_this_rule",
  "suggestedTitle": "Human-readable title for this requirement",
  "suggestedCheckboxLabel": "The exact text an applicant would need to acknowledge (if acknowledgment/authorization type)",
  "suggestedDisclosureText": "Disclosure text to show applicants explaining the requirement",
  "statuteReference": "Legal citation (e.g., 'State Code § X.XXX')",
  "explanation": "Brief explanation of why this affects applications or why it doesn't"
}

Be conservative - only set affectsApplications: true if the bill CLEARLY creates a new application-related requirement.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a legal analyst specializing in landlord-tenant law and rental application compliance requirements.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(response);

      return {
        affectsApplications: parsed.affectsApplications === true,
        complianceRuleType: parsed.complianceRuleType || null,
        suggestedRuleKey: parsed.suggestedRuleKey || null,
        suggestedTitle: parsed.suggestedTitle || null,
        suggestedCheckboxLabel: parsed.suggestedCheckboxLabel || null,
        suggestedDisclosureText: parsed.suggestedDisclosureText || null,
        statuteReference: parsed.statuteReference || null,
        explanation: parsed.explanation || '',
      };
    } catch (error) {
      console.error('Error analyzing bill application impact with AI:', error);
      
      // Fallback - check for application-related keywords
      const text = `${billTitle} ${billDescription}`.toLowerCase();
      const applicationKeywords = [
        'application',
        'screening',
        'tenant selection',
        'background check',
        'credit check',
        'criminal history',
        'prospective tenant',
        'applicant',
        'application fee',
      ];
      
      const hasApplicationKeyword = applicationKeywords.some(k => text.includes(k));
      
      return {
        affectsApplications: hasApplicationKeyword,
        complianceRuleType: hasApplicationKeyword ? 'disclosure' : null,
        suggestedRuleKey: null,
        suggestedTitle: null,
        suggestedCheckboxLabel: null,
        suggestedDisclosureText: null,
        statuteReference: null,
        explanation: hasApplicationKeyword 
          ? 'This bill contains application-related keywords. Manual review required to determine specific compliance requirements.'
          : 'This bill does not appear to affect rental application requirements.',
      };
    }
  }
}

export const billAnalysisService = new BillAnalysisService();
