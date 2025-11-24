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
3. What changes would be required to those templates?

BILL INFORMATION:
Title: ${billTitle}
Description: ${billDescription}
${billText ? `\n\nFull Bill Text:\n${billText.substring(0, 10000)}` : ''}

AVAILABLE TEMPLATES FOR ${stateId}:
${templateList}

Please respond in JSON format with:
{
  "relevanceLevel": "high" | "medium" | "low" | "dismissed",
  "analysis": "Brief explanation of why this bill matters or doesn't matter to landlords",
  "affectedTemplateIds": ["template-id-1", "template-id-2"],
  "recommendedChanges": "Specific changes needed to affected templates, or empty string if no changes needed"
}

Relevance Guidelines:
- HIGH: Directly changes landlord-tenant law, requires immediate template updates
- MEDIUM: Related to rental housing, may affect templates indirectly
- LOW: Tangentially related to housing, unlikely to affect templates
- DISMISSED: Not related to landlord-tenant law at all

Be conservative - only mark as HIGH if templates definitely need updates.`;

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

      return {
        relevanceLevel: parsed.relevanceLevel,
        aiAnalysis: parsed.analysis,
        affectedTemplateIds: validTemplateIds,
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
    
    const highPriorityKeywords = [
      'eviction',
      'security deposit',
      'lease termination',
      'notice requirement',
      'habitability',
      'rent increase',
    ];

    const mediumPriorityKeywords = [
      'landlord',
      'tenant',
      'rental',
      'lease',
    ];

    const hasHighPriority = highPriorityKeywords.some(k => text.includes(k));
    const hasMediumPriority = mediumPriorityKeywords.some(k => text.includes(k));

    if (hasHighPriority) {
      return {
        relevanceLevel: 'high',
        aiAnalysis: 'This bill contains keywords indicating it directly affects landlord-tenant law. Manual review required.',
        affectedTemplateIds: [],
        recommendedChanges: 'Manual review needed to determine specific changes.',
      };
    } else if (hasMediumPriority) {
      return {
        relevanceLevel: 'medium',
        aiAnalysis: 'This bill may be related to landlord-tenant law. Review recommended.',
        affectedTemplateIds: [],
        recommendedChanges: '',
      };
    } else {
      return {
        relevanceLevel: 'low',
        aiAnalysis: 'This bill does not appear to be directly related to landlord-tenant law.',
        affectedTemplateIds: [],
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

      return {
        relevanceLevel: parsed.relevanceLevel,
        aiAnalysis: parsed.analysis,
        affectedTemplateIds: validTemplateIds,
        recommendedChanges: parsed.recommendedChanges || '',
      };
    } catch (error) {
      console.error('Error analyzing case with AI:', error);
      
      // Fallback to basic keyword analysis if AI fails
      return this.fallbackAnalysis(caseName, caseNameFull);
    }
  }
}

export const billAnalysisService = new BillAnalysisService();
