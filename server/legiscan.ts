import OpenAI from "openai";

if (!process.env.LEGISCAN_API_KEY) {
  console.warn('Warning: LEGISCAN_API_KEY not set. Legislative monitoring will not work.');
}

const LEGISCAN_API_BASE = 'https://api.legiscan.com/';
const API_KEY = process.env.LEGISCAN_API_KEY;

// State codes mapping
const STATE_CODES: Record<string, string> = {
  'UT': 'UT',
  'TX': 'TX',
  'ND': 'ND',
  'SD': 'SD',
};

// LegiScan API response types
interface LegiScanBill {
  bill_id: number;
  change_hash: string;
  session_id: number;
  session: {
    session_id: number;
    state_id: number;
    year_start: number;
    year_end: number;
    special: number;
    session_name: string;
  };
  bill_number: string;
  bill_type: string;
  bill_type_id: string;
  body: string;
  body_id: number;
  current_body: string;
  current_body_id: number;
  title: string;
  description: string;
  state: string;
  state_id: number;
  status: number;
  status_date: string;
  progress: Array<{
    date: string;
    event: number;
  }>;
  url: string;
  state_link: string;
  completed: number;
  last_action: string;
  last_action_date: string;
}

interface LegiScanSearchResult {
  status: string;
  searchresult?: {
    summary: {
      count: number;
      page: number;
      page_total: number;
      page_size: number;
    };
    results?: LegiScanBill[];
  };
}

interface BillDetails {
  billId: string;
  stateId: string;
  billNumber: string;
  title: string;
  description: string;
  status: string;
  url: string;
  lastAction: string;
  lastActionDate: string;
}

// Initialize OpenAI for AI analysis
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export class LegiScanService {
  private async makeRequest(operation: string, params: Record<string, any> = {}): Promise<any> {
    if (!API_KEY) {
      throw new Error('LEGISCAN_API_KEY not configured');
    }

    const url = new URL(LEGISCAN_API_BASE);
    url.searchParams.append('key', API_KEY);
    url.searchParams.append('op', operation);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`LegiScan API error: ${response.statusText}`);
    }

    return response.json();
  }

  async searchBills(stateCode: string, query: string, year?: number): Promise<BillDetails[]> {
    try {
      const currentYear = year || new Date().getFullYear();
      
      const data: LegiScanSearchResult = await this.makeRequest('getSearch', {
        state: stateCode,
        query: query,
        year: currentYear,
      });

      if (data.status !== 'OK' || !data.searchresult?.results) {
        return [];
      }

      return data.searchresult.results.map(bill => ({
        billId: String(bill.bill_id),
        stateId: stateCode,
        billNumber: bill.bill_number,
        title: bill.title,
        description: bill.description,
        status: this.mapBillStatus(bill.status),
        url: bill.url,
        lastAction: bill.last_action,
        lastActionDate: bill.last_action_date,
      }));
    } catch (error) {
      console.error(`Error searching bills for ${stateCode}:`, error);
      return [];
    }
  }

  async getBillDetails(billId: string): Promise<any> {
    try {
      const data = await this.makeRequest('getBill', { id: billId });
      return data;
    } catch (error) {
      console.error(`Error fetching bill ${billId}:`, error);
      return null;
    }
  }

  private mapBillStatus(statusCode: number): string {
    // LegiScan status codes: 1=introduced, 2=engrossed, 3=enrolled, 4=passed, 5=vetoed, 6=failed/dead
    const statusMap: Record<number, string> = {
      1: 'introduced',
      2: 'in_committee',
      3: 'passed_chamber',
      4: 'signed',
      5: 'vetoed',
      6: 'dead',
    };
    return statusMap[statusCode] || 'introduced';
  }

  async analyzeBillRelevance(bill: BillDetails, templates: Array<{ id: string; title: string; templateType: string }>): Promise<{
    relevanceLevel: 'high' | 'medium' | 'low' | 'dismissed';
    aiAnalysis: string;
    affectedTemplateIds: string[];
  }> {
    try {
      const templateList = templates.map(t => `- ${t.title} (${t.templateType})`).join('\n');

      const prompt = `You are a legal analyst specializing in landlord-tenant law. Analyze this proposed legislation and determine:

1. Is this bill relevant to landlord-tenant relationships and rental property management?
2. If relevant, which specific templates would need to be updated?
3. What is the impact level?

BILL INFORMATION:
Title: ${bill.title}
Number: ${bill.billNumber}
State: ${bill.stateId}
Description: ${bill.description}
Last Action: ${bill.lastAction}

AVAILABLE TEMPLATES:
${templateList}

ANALYSIS INSTRUCTIONS:
- HIGH relevance: Directly changes lease requirements, security deposits, eviction procedures, tenant rights, or landlord obligations
- MEDIUM relevance: Affects compliance requirements, reporting, or procedural changes that might indirectly impact templates
- LOW relevance: Tangentially related to housing but unlikely to require template changes
- DISMISSED: Not related to landlord-tenant law

Respond in this exact JSON format:
{
  "relevanceLevel": "high|medium|low|dismissed",
  "reasoning": "Brief explanation of why this matters (or doesn't)",
  "affectedTemplates": ["template-id-1", "template-id-2"],
  "recommendedChanges": "What specific changes might be needed (or empty string if dismissed)"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a legal analyst specializing in landlord-tenant law. Analyze legislation and provide structured JSON responses."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');

      return {
        relevanceLevel: analysis.relevanceLevel || 'low',
        aiAnalysis: `${analysis.reasoning}\n\nRecommended Changes: ${analysis.recommendedChanges || 'None'}`,
        affectedTemplateIds: analysis.affectedTemplates || [],
      };
    } catch (error) {
      console.error('Error analyzing bill relevance:', error);
      return {
        relevanceLevel: 'low',
        aiAnalysis: 'Error analyzing bill relevance. Manual review recommended.',
        affectedTemplateIds: [],
      };
    }
  }

  async searchLandlordTenantBills(stateCode: string, year?: number): Promise<BillDetails[]> {
    const searchTerms = [
      'landlord tenant',
      'rental property',
      'lease agreement',
      'security deposit',
      'eviction',
      'residential tenancy',
    ];

    const allBills: BillDetails[] = [];
    const seenBillIds = new Set<string>();

    for (const term of searchTerms) {
      const bills = await this.searchBills(stateCode, term, year);
      
      bills.forEach(bill => {
        if (!seenBillIds.has(bill.billId)) {
          seenBillIds.add(bill.billId);
          allBills.push(bill);
        }
      });

      // Rate limiting: wait 500ms between queries to avoid hitting API limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return allBills;
  }
}

export const legiScanService = new LegiScanService();
