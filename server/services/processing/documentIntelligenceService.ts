import type { Document, RFP } from '@shared/schema';
import OpenAI from 'openai';
import { storage } from '../../storage';

export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'signature' | 'attachment';
  required: boolean;
  description: string;
  value?: string;
  category:
    | 'company_info'
    | 'financial'
    | 'technical'
    | 'compliance'
    | 'pricing';
  humanRequired?: boolean;
  researchNeeded?: boolean;
}

export interface HumanOversightItem {
  id: string;
  type:
    | 'signature'
    | 'notarization'
    | 'payment'
    | 'physical_document'
    | 'meeting'
    | 'inspection';
  description: string;
  deadline?: Date;
  requirements: string[];
  urgency: 'low' | 'medium' | 'high';
  estimatedTime: string; // e.g., "30 minutes", "2 hours"
}

export interface CompetitiveBidAnalysis {
  suggestedBidAmount: number;
  confidenceLevel: number;
  marketResearch: {
    averageBid: number;
    bidRange: { min: number; max: number };
    competitorCount: number;
    sources: string[];
  };
  pricingStrategy: 'aggressive' | 'competitive' | 'premium';
  riskFactors: string[];
}

export interface DocumentAnalysisResult {
  formFields: FormField[];
  humanOversightItems: HumanOversightItem[];
  competitiveBidAnalysis?: CompetitiveBidAnalysis;
  processingInstructions: string[];
  estimatedCompletionTime: string;
}

export class DocumentIntelligenceService {
  private openaiClient: OpenAI;

  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze all documents for an RFP to identify fillable fields and requirements
   */
  async analyzeRFPDocuments(rfpId: string): Promise<DocumentAnalysisResult> {
    console.log(`Starting intelligent analysis for RFP: ${rfpId}`);

    // Get RFP and all its documents
    const rfp = await storage.getRFP(rfpId);
    if (!rfp) {
      throw new Error(`RFP not found: ${rfpId}`);
    }

    const documents = await storage.getDocumentsByRFP(rfpId);
    console.log(
      `Found ${documents.length} documents to analyze for RFP: ${rfp.title}`
    );

    // Analyze each document to extract forms and fields
    const allFormFields: FormField[] = [];
    const humanOversightItems: HumanOversightItem[] = [];
    const processingInstructions: string[] = [];

    for (const document of documents) {
      if ((document.parsedData as any)?.needsFillOut) {
        console.log(`Analyzing fillable document: ${document.filename}`);

        const analysis = await this.analyzeDocument(document, rfp);
        allFormFields.push(...analysis.formFields);
        humanOversightItems.push(...analysis.humanOversightItems);
        processingInstructions.push(...analysis.instructions);
      }
    }

    // Research competitive pricing if this is a bid/pricing RFP
    let competitiveBidAnalysis: CompetitiveBidAnalysis | undefined;
    const hasPricingFields = allFormFields.some(
      field => field.category === 'pricing' || field.category === 'financial'
    );

    if (hasPricingFields) {
      console.log(`Pricing fields detected, researching competitive bids...`);
      competitiveBidAnalysis = await this.researchCompetitivePricing(
        rfp,
        allFormFields
      );
    }

    // Calculate estimated completion time
    const estimatedTime = this.calculateCompletionTime(
      allFormFields,
      humanOversightItems
    );

    return {
      formFields: allFormFields,
      humanOversightItems,
      competitiveBidAnalysis,
      processingInstructions,
      estimatedCompletionTime: estimatedTime,
    };
  }

  /**
   * Analyze a single document to extract form fields and requirements
   */
  private async analyzeDocument(
    document: Document,
    rfp: RFP
  ): Promise<{
    formFields: FormField[];
    humanOversightItems: HumanOversightItem[];
    instructions: string[];
  }> {
    const documentText = document.extractedText || '';

    const prompt = `
Analyze this RFP document and identify all fields that need to be filled out for submission. Pay special attention to:

1. Form fields (text inputs, checkboxes, signature lines, etc.)
2. Required attachments or supporting documents
3. Items requiring human oversight (signatures, notarization, payments, etc.)
4. Pricing/bid amount fields
5. Company information fields
6. Technical specification fields
7. Compliance certification fields

RFP Context:
- Title: ${rfp.title}
- Agency: ${rfp.agency}
- Deadline: ${rfp.deadline || 'Not specified'}

Document: ${document.filename}
Content:
${documentText.substring(0, 15000)} // Limit to avoid token limits

Return a JSON object with this structure:
{
  "formFields": [
    {
      "id": "unique_field_id",
      "name": "Field Name",
      "type": "text|number|date|checkbox|signature|attachment",
      "required": true,
      "description": "What this field is for",
      "category": "company_info|financial|technical|compliance|pricing",
      "humanRequired": false,
      "researchNeeded": false
    }
  ],
  "humanOversightItems": [
    {
      "id": "unique_item_id",
      "type": "signature|notarization|payment|physical_document|meeting|inspection",
      "description": "What needs human attention",
      "requirements": ["List of specific requirements"],
      "urgency": "low|medium|high",
      "estimatedTime": "30 minutes"
    }
  ],
  "instructions": [
    "Step-by-step processing instructions"
  ]
}

Focus on iByte Enterprises LLC - a woman-owned construction/technology company with WBENC, HUB, DBE, MBE, WBE certifications.
`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-5',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert document analyst specializing in government RFP forms and requirements. Return only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const analysis = JSON.parse(content);

      // Generate unique IDs for form fields and oversight items
      analysis.formFields = analysis.formFields.map(
        (field: any, index: number) => ({
          ...field,
          id: field.id || `${document.id}_field_${index}`,
        })
      );

      analysis.humanOversightItems = analysis.humanOversightItems.map(
        (item: any, index: number) => ({
          ...item,
          id: item.id || `${document.id}_oversight_${index}`,
        })
      );

      return analysis;
    } catch (error) {
      console.error(`Error analyzing document ${document.filename}:`, error);
      return {
        formFields: [],
        humanOversightItems: [],
        instructions: [`Failed to analyze document: ${document.filename}`],
      };
    }
  }

  /**
   * Research competitive pricing using web search and AI analysis
   */
  private async researchCompetitivePricing(
    rfp: RFP,
    formFields: FormField[]
  ): Promise<CompetitiveBidAnalysis> {
    console.log(`Researching competitive pricing for: ${rfp.title}`);

    // Extract key terms for market research
    const searchTerms = this.extractSearchTerms(rfp, formFields);

    const prompt = `
Analyze this RFP and provide competitive pricing recommendations:

RFP Details:
- Title: ${rfp.title}
- Agency: ${rfp.agency}
- Description: ${rfp.description || 'Not provided'}
- Estimated Value: ${rfp.estimatedValue || 'Not specified'}

Key Search Terms: ${searchTerms.join(', ')}

Based on typical government contract pricing for similar services, provide:

1. Suggested bid amount (be competitive but not underbid)
2. Market research insights
3. Pricing strategy recommendation
4. Risk factors to consider

Focus on services that iByte Enterprises LLC (construction/technology company) would typically provide.

Return JSON:
{
  "suggestedBidAmount": 150000,
  "confidenceLevel": 0.75,
  "marketResearch": {
    "averageBid": 140000,
    "bidRange": {"min": 120000, "max": 180000},
    "competitorCount": 8,
    "sources": ["Similar government contracts", "Industry benchmarks"]
  },
  "pricingStrategy": "competitive",
  "riskFactors": ["Short timeline", "Complex requirements"]
}
`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-5',
        messages: [
          {
            role: 'system',
            content:
              'You are a government contracting expert specializing in competitive pricing analysis. Return only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from pricing analysis');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Error researching competitive pricing:', error);

      // Return default analysis if AI fails
      const estimatedValue = rfp.estimatedValue
        ? parseFloat(rfp.estimatedValue)
        : 100000;
      return {
        suggestedBidAmount: estimatedValue * 0.85, // Bid 15% below estimated value
        confidenceLevel: 0.4,
        marketResearch: {
          averageBid: estimatedValue,
          bidRange: { min: estimatedValue * 0.7, max: estimatedValue * 1.2 },
          competitorCount: 5,
          sources: ['Estimated based on RFP value'],
        },
        pricingStrategy: 'competitive',
        riskFactors: ['Limited market research available'],
      };
    }
  }

  /**
   * Extract search terms for market research
   */
  private extractSearchTerms(rfp: RFP, formFields: FormField[]): string[] {
    const terms = new Set<string>();

    // Add terms from RFP title and description
    const text = `${rfp.title} ${rfp.description || ''}`.toLowerCase();

    // Common service categories
    const serviceKeywords = [
      'construction',
      'technology',
      'consulting',
      'software',
      'hardware',
      'maintenance',
      'support',
      'installation',
      'development',
      'design',
    ];

    serviceKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        terms.add(keyword);
      }
    });

    // Add agency for location-specific research
    if (rfp.agency) {
      terms.add(rfp.agency.toLowerCase());
    }

    // Add pricing-related terms from form fields
    formFields
      .filter(
        field => field.category === 'pricing' || field.category === 'financial'
      )
      .forEach(field => {
        if (field.name.length < 50) {
          // Avoid very long field names
          terms.add(field.name.toLowerCase());
        }
      });

    return Array.from(terms).slice(0, 10); // Limit to top 10 terms
  }

  /**
   * Calculate estimated completion time based on complexity
   */
  private calculateCompletionTime(
    formFields: FormField[],
    humanOversightItems: HumanOversightItem[]
  ): string {
    let totalMinutes = 0;

    // Base time per form field
    formFields.forEach(field => {
      switch (field.type) {
        case 'text':
          totalMinutes += field.category === 'pricing' ? 15 : 5;
          break;
        case 'number':
          totalMinutes += 10;
          break;
        case 'date':
          totalMinutes += 3;
          break;
        case 'checkbox':
          totalMinutes += 2;
          break;
        case 'signature':
          totalMinutes += 20; // Human interaction required
          break;
        case 'attachment':
          totalMinutes += 30; // Document preparation time
          break;
      }

      // Add extra time for research-needed fields
      if (field.researchNeeded) {
        totalMinutes += 20;
      }
    });

    // Add time for human oversight items
    humanOversightItems.forEach(item => {
      const timeStr = item.estimatedTime || '30 minutes';
      const minutes = this.parseTimeToMinutes(timeStr);
      totalMinutes += minutes;
    });

    // Convert to human-readable format
    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    } else if (totalMinutes < 480) {
      // Less than 8 hours
      const hours = Math.round((totalMinutes / 60) * 10) / 10; // Round to 1 decimal
      return `${hours} hours`;
    } else {
      const days = Math.ceil(totalMinutes / 480); // 8 hours per day
      return `${days} business days`;
    }
  }

  /**
   * Parse time string to minutes
   */
  private parseTimeToMinutes(timeStr: string): number {
    const lowerStr = timeStr.toLowerCase();

    if (lowerStr.includes('hour')) {
      const hours = parseFloat(lowerStr.match(/(\d+\.?\d*)/)?.[1] || '1');
      return hours * 60;
    } else if (lowerStr.includes('day')) {
      const days = parseFloat(lowerStr.match(/(\d+\.?\d*)/)?.[1] || '1');
      return days * 480; // 8 hours per day
    } else {
      // Assume minutes
      const minutes = parseFloat(lowerStr.match(/(\d+\.?\d*)/)?.[1] || '30');
      return minutes;
    }
  }

  /**
   * Auto-fill form fields with company data or AI-generated content
   */
  async autoFillFormFields(
    rfpId: string,
    formFields: FormField[],
    companyProfileId?: string
  ): Promise<FormField[]> {
    console.log(
      `Auto-filling ${formFields.length} form fields for RFP: ${rfpId}`
    );

    // Get company profile if provided
    let companyProfile = null;
    if (companyProfileId) {
      companyProfile = await storage.getCompanyProfile(companyProfileId);
      if (!companyProfile) {
        console.warn(`Company profile not found: ${companyProfileId}`);
      }
    }

    // Auto-fill each field
    const filledFields = await Promise.all(
      formFields.map(async field => {
        if (field.humanRequired) {
          // Skip fields that require human input
          return field;
        }

        const filledValue = await this.fillFormField(field, companyProfile);
        return {
          ...field,
          value: filledValue,
        };
      })
    );

    console.log(
      `Successfully auto-filled ${
        filledFields.filter(f => f.value).length
      } out of ${formFields.length} fields`
    );
    return filledFields;
  }

  /**
   * Fill a single form field with appropriate data
   */
  private async fillFormField(
    field: FormField,
    companyProfile: any
  ): Promise<string | undefined> {
    // Fill company info fields from profile
    if (field.category === 'company_info' && companyProfile) {
      return this.fillCompanyInfoField(field, companyProfile);
    }

    // Fill compliance fields with known certifications
    if (field.category === 'compliance') {
      return this.fillComplianceField(field);
    }

    // Leave pricing and technical fields for human review or research
    if (field.category === 'pricing' || field.category === 'technical') {
      if (field.researchNeeded) {
        return 'TO BE RESEARCHED';
      }
      return undefined;
    }

    return undefined;
  }

  /**
   * Fill company information fields from profile
   */
  private fillCompanyInfoField(
    field: FormField,
    companyProfile: any
  ): string | undefined {
    const lowerName = field.name.toLowerCase();
    const lowerDesc = field.description.toLowerCase();

    // Company name variations
    if (
      lowerName.includes('company') ||
      lowerName.includes('business') ||
      lowerName.includes('firm')
    ) {
      if (lowerName.includes('name')) {
        return companyProfile.companyName;
      }
    }

    // DBA/Trade name
    if (lowerName.includes('dba') || lowerName.includes('trade')) {
      return companyProfile.dba || companyProfile.companyName;
    }

    // Website
    if (lowerName.includes('website') || lowerName.includes('url')) {
      return companyProfile.website;
    }

    // Business category
    if (
      lowerName.includes('category') ||
      lowerName.includes('type') ||
      lowerDesc.includes('business type')
    ) {
      return (
        companyProfile.primaryBusinessCategory ||
        'Construction/Technology Services'
      );
    }

    // Employee count
    if (lowerName.includes('employee') || lowerName.includes('staff')) {
      return companyProfile.employeesCount || '10-50';
    }

    return undefined;
  }

  /**
   * Fill compliance/certification fields with known certifications
   */
  private fillComplianceField(field: FormField): string | undefined {
    const lowerName = field.name.toLowerCase();
    const lowerDesc = field.description.toLowerCase();

    // Woman-owned business certifications
    if (
      lowerName.includes('woman') ||
      lowerName.includes('wbe') ||
      lowerName.includes('wbenc')
    ) {
      return 'Yes - WBENC Certified';
    }

    // HUB certification
    if (
      lowerName.includes('hub') ||
      lowerDesc.includes('historically underutilized')
    ) {
      return 'Yes - HUB Certified';
    }

    // DBE certification
    if (
      lowerName.includes('dbe') ||
      lowerDesc.includes('disadvantaged business')
    ) {
      return 'Yes - DBE Certified';
    }

    // MBE certification
    if (lowerName.includes('mbe') || lowerDesc.includes('minority business')) {
      return 'Yes - MBE Certified';
    }

    // Small business
    if (
      lowerName.includes('small business') ||
      lowerName.includes('small biz')
    ) {
      return 'Yes - Small Business';
    }

    return undefined;
  }
}

export const documentIntelligenceService = new DocumentIntelligenceService();
