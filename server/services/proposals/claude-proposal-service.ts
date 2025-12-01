import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type {
  CompanyDataMapping,
  GeneratedProposalContent,
  RFPAnalysisResult,
} from './ai-proposal-service.js';
import type { DefaultCompanyMappingConfig } from '../../config/defaultCompanyMapping.js';
import {
  thinkingConfigs,
  type ThinkingConfigKey,
} from '../../../src/mastra/models/index.js';

/**
 * Proposal Quality Level
 * Determines the model and thinking budget to use for generation
 */
export type ProposalQualityLevel =
  | 'fast' // Quick draft, no thinking
  | 'standard' // Sonnet 4.5 with 10k thinking
  | 'enhanced' // Sonnet 4.5 with 16k thinking
  | 'premium' // Opus 4.5 with 24k thinking
  | 'maximum'; // Opus 4.5 with 32k thinking

/**
 * Options for proposal generation with Claude
 */
export interface ClaudeProposalOptions {
  qualityLevel: ProposalQualityLevel;
  enableThinking?: boolean;
  customBudgetTokens?: number;
  temperature?: number;
  sections?: string[];
}

/**
 * Extended proposal content with more comprehensive sections
 */
export interface ExtendedProposalContent extends GeneratedProposalContent {
  // Additional comprehensive sections
  problemStatement?: string;
  solutionOverview?: string;
  valueProposition?: string;
  implementationPlan?: string;
  riskMitigation?: string;
  successMetrics?: string;
  staffingPlan?: string;
  pastPerformance?: string;
  differentiators?: string;
  managementApproach?: string;
  // Generation metadata
  metadata: {
    model: string;
    qualityLevel: ProposalQualityLevel;
    thinkingEnabled: boolean;
    thinkingTokensUsed?: number;
    totalTokensUsed: number;
    generationTimeMs: number;
  };
}

// Zod schema for comprehensive proposal validation
const ExtendedProposalContentSchema = z.object({
  executiveSummary: z.string().min(500, 'Executive summary must be at least 500 characters'),
  companyOverview: z.string().min(300, 'Company overview must be at least 300 characters'),
  qualifications: z.string().min(400, 'Qualifications must be at least 400 characters'),
  approach: z.string().min(500, 'Approach must be at least 500 characters'),
  timeline: z.string().min(200, 'Timeline must be at least 200 characters'),
  certificationNarratives: z.array(z.string()),
  complianceMatrix: z.array(
    z.object({
      requirement: z.string(),
      response: z.string(),
      evidence: z.array(z.string()),
    })
  ),
  attachmentRecommendations: z.array(z.string()),
  // Optional extended sections
  problemStatement: z.string().optional(),
  solutionOverview: z.string().optional(),
  valueProposition: z.string().optional(),
  implementationPlan: z.string().optional(),
  riskMitigation: z.string().optional(),
  successMetrics: z.string().optional(),
  staffingPlan: z.string().optional(),
  pastPerformance: z.string().optional(),
  differentiators: z.string().optional(),
  managementApproach: z.string().optional(),
});

/**
 * Claude-based Proposal Generation Service
 *
 * Uses Claude Sonnet 4.5 or Opus 4.5 with extended thinking mode
 * to generate comprehensive, high-quality RFP proposals.
 */
export class ClaudeProposalService {
  private anthropicClient: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      throw new Error(
        'ANTHROPIC_API_KEY env var is required for ClaudeProposalService'
      );
    }
    this.anthropicClient = new Anthropic({
      apiKey: apiKey,
    });
  }

  /**
   * Get the thinking configuration for a quality level
   */
  private getThinkingConfig(qualityLevel: ProposalQualityLevel) {
    const configMap: Record<ProposalQualityLevel, ThinkingConfigKey> = {
      fast: 'fast',
      standard: 'standard',
      enhanced: 'enhanced',
      premium: 'premium',
      maximum: 'maximum',
    };
    return thinkingConfigs[configMap[qualityLevel]];
  }

  /**
   * Generate comprehensive proposal content using Claude with extended thinking
   */
  async generateProposalContent(
    analysis: RFPAnalysisResult,
    companyMapping: CompanyDataMapping | DefaultCompanyMappingConfig,
    rfpText: string,
    options: ClaudeProposalOptions = { qualityLevel: 'standard' }
  ): Promise<ExtendedProposalContent> {
    const startTime = Date.now();
    const config = this.getThinkingConfig(options.qualityLevel);
    const enableThinking = options.enableThinking ?? (config.thinking !== undefined);

    const companyInfo = this.formatCompanyInformation(companyMapping);
    const companyName = companyMapping.profile.companyName;

    // Build a comprehensive prompt for extensive proposal generation
    const prompt = this.buildProposalPrompt(
      companyName,
      companyInfo,
      rfpText,
      analysis,
      companyMapping,
      options.qualityLevel
    );

    try {
      // Build the request parameters
      const requestParams: Anthropic.MessageCreateParams = {
        model: config.model,
        max_tokens: config.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      // Add thinking configuration if enabled
      if (enableThinking && config.thinking) {
        (requestParams as any).thinking = {
          type: config.thinking.type,
          budget_tokens: options.customBudgetTokens ?? config.thinking.budget_tokens,
        };
      }

      // Add system prompt for JSON response
      requestParams.system = this.getSystemPrompt(options.qualityLevel);

      console.log(`[ClaudeProposalService] Generating proposal with ${config.model}, thinking: ${enableThinking}`);

      const response = await this.anthropicClient.messages.create(requestParams);

      // Extract the text content from response
      let contentText = '';
      let thinkingTokensUsed = 0;

      for (const block of response.content) {
        if (block.type === 'text') {
          contentText = block.text;
        } else if (block.type === 'thinking') {
          // Track thinking usage
          thinkingTokensUsed = (block as any).thinking_tokens || 0;
          console.log(`[ClaudeProposalService] Thinking used ${thinkingTokensUsed} tokens`);
        }
      }

      if (!contentText) {
        throw new Error('No content generated from Claude');
      }

      // Parse JSON from response (may be wrapped in markdown code blocks)
      const jsonContent = this.extractJSON(contentText);
      const rawContent = JSON.parse(jsonContent);

      // Validate with Zod (lenient validation for optional fields)
      const validatedContent = ExtendedProposalContentSchema.safeParse(rawContent);

      if (!validatedContent.success) {
        console.error(
          '[ClaudeProposalService] Validation errors:',
          validatedContent.error.issues
        );
        // Still use the content if core fields are present
        if (!rawContent.executiveSummary || !rawContent.approach) {
          throw new Error('Invalid proposal content format from Claude');
        }
      }

      const endTime = Date.now();
      const generationTimeMs = endTime - startTime;

      // Return extended content with metadata
      return {
        ...(validatedContent.success ? validatedContent.data : rawContent),
        metadata: {
          model: config.model,
          qualityLevel: options.qualityLevel,
          thinkingEnabled: enableThinking,
          thinkingTokensUsed,
          totalTokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          generationTimeMs,
        },
      };
    } catch (error) {
      console.error('[ClaudeProposalService] Error generating proposal:', error);
      throw new Error(
        `Failed to generate proposal with Claude: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Build a comprehensive prompt for proposal generation
   */
  private buildProposalPrompt(
    companyName: string,
    companyInfo: string,
    rfpText: string,
    analysis: RFPAnalysisResult,
    companyMapping: CompanyDataMapping | DefaultCompanyMappingConfig,
    qualityLevel: ProposalQualityLevel
  ): string {
    const isHighQuality = ['premium', 'maximum'].includes(qualityLevel);
    const sectionInstructions = isHighQuality
      ? this.getPremiumSectionInstructions()
      : this.getStandardSectionInstructions();

    return `You are an expert government proposal writer creating a comprehensive, winning proposal for ${companyName} in response to the following RFP.

## YOUR TASK
Generate an extensive, detailed, and persuasive proposal that will maximize ${companyName}'s chances of winning this RFP. Every section must be substantial, specific, and directly address the RFP requirements.

## QUALITY EXPECTATIONS
- Each major section should be 500-1500 words
- Use specific examples, metrics, and evidence
- Address EVERY requirement from the RFP
- Demonstrate deep understanding of the agency's needs
- Highlight competitive advantages and differentiators
- Write in professional, persuasive government contracting language

## COMPANY INFORMATION
${companyInfo}

## RFP DOCUMENT
${rfpText}

## EXTRACTED REQUIREMENTS ANALYSIS
${JSON.stringify(analysis.requirements, null, 2)}

## COMPLIANCE ITEMS TO ADDRESS
${JSON.stringify(analysis.complianceItems, null, 2)}

## KEY DATES
- Submission Deadline: ${analysis.keyDates.deadline.toISOString()}
${analysis.keyDates.prebidMeeting ? `- Pre-bid Meeting: ${analysis.keyDates.prebidMeeting.toISOString()}` : ''}
${analysis.keyDates.questionsDeadline ? `- Questions Deadline: ${analysis.keyDates.questionsDeadline.toISOString()}` : ''}

## COMPANY FACTS TO INCORPORATE
${this.buildCompanyFacts(companyMapping)}

## SECTION REQUIREMENTS
${sectionInstructions}

## OUTPUT FORMAT
Return a JSON object with the following structure. Each field should contain substantial, detailed content:

{
  "executiveSummary": "[3-4 detailed paragraphs explaining why ${companyName} is uniquely qualified, highlighting specific certifications, experience, competitive advantages, and value proposition. Must be compelling and persuasive.]",

  "companyOverview": "[Comprehensive 2-3 paragraph overview of ${companyName}'s business history, capabilities, market position, and relevant experience. Include specific metrics and achievements.]",

  "problemStatement": "[Clear articulation of the agency's challenges and needs as expressed in the RFP. Demonstrate deep understanding of their situation.]",

  "solutionOverview": "[High-level summary of ${companyName}'s proposed solution and how it addresses the agency's needs. Be specific about deliverables.]",

  "valueProposition": "[Compelling explanation of the unique value ${companyName} brings compared to competitors. Focus on ROI and benefits.]",

  "qualifications": "[Detailed description of ${companyName}'s specific qualifications, certifications, past performance, and technical capabilities relevant to this RFP. Include evidence.]",

  "approach": "[Comprehensive methodology for completing this project, including phases, tools, processes, and quality assurance measures. Be specific and actionable.]",

  "implementationPlan": "[Detailed step-by-step implementation plan with milestones, dependencies, and resource requirements.]",

  "timeline": "[Realistic project timeline with specific phases, milestones, deliverables, and durations based on the RFP requirements.]",

  "staffingPlan": "[Description of the team structure, key personnel roles, qualifications, and availability for this project.]",

  "riskMitigation": "[Identification of potential risks and detailed mitigation strategies for each.]",

  "successMetrics": "[Specific, measurable KPIs and success criteria for the project.]",

  "pastPerformance": "[Relevant past contract examples demonstrating similar successful work. Include agency names, contract values, and outcomes where applicable.]",

  "differentiators": "[Clear articulation of what sets ${companyName} apart from competitors for this specific opportunity.]",

  "managementApproach": "[Description of project management methodology, communication plan, and governance structure.]",

  "certificationNarratives": ["[Detailed explanation of each relevant certification and its value to the government. Include certification numbers and expiration dates.]"],

  "complianceMatrix": [
    {
      "requirement": "[Specific requirement from the RFP]",
      "response": "[Detailed explanation of how ${companyName} meets this requirement with evidence]",
      "evidence": ["[Specific documents, certifications, or examples that demonstrate compliance]"]
    }
  ],

  "attachmentRecommendations": ["[Specific documents ${companyName} should attach to support the proposal, with descriptions of each]"]
}

CRITICAL INSTRUCTIONS:
1. Generate ACTUAL detailed content - NEVER use placeholder text like "content...", "approach content...", or "[insert here]"
2. Each section must be substantial, specific, and directly relevant to this RFP
3. Reference specific RFP requirements throughout
4. Use ${companyName}'s actual certifications and capabilities
5. Write in professional government contracting language
6. Ensure all content is factually consistent across sections
7. The complianceMatrix must address EVERY requirement identified in the analysis`;
  }

  /**
   * Get section instructions for premium quality proposals
   */
  private getPremiumSectionInstructions(): string {
    return `
PREMIUM QUALITY REQUIREMENTS:
- Executive Summary: 800-1200 words, extremely persuasive with specific win themes
- Company Overview: 600-900 words with detailed history and achievements
- Problem Statement: 400-600 words demonstrating deep understanding
- Solution Overview: 600-800 words with clear deliverables
- Value Proposition: 400-600 words with ROI analysis
- Qualifications: 800-1200 words with specific evidence
- Technical Approach: 1000-1500 words with detailed methodology
- Implementation Plan: 800-1200 words with milestone details
- Timeline: Detailed Gantt-style breakdown with durations
- Staffing Plan: 400-600 words with role descriptions
- Risk Mitigation: 500-700 words covering all risk categories
- Success Metrics: 300-500 words with specific KPIs
- Past Performance: 600-800 words with 3-5 relevant examples
- Differentiators: 400-600 words highlighting unique capabilities
- Management Approach: 400-600 words on governance structure
- Compliance Matrix: Minimum 10 detailed requirement-response pairs`;
  }

  /**
   * Get section instructions for standard quality proposals
   */
  private getStandardSectionInstructions(): string {
    return `
STANDARD QUALITY REQUIREMENTS:
- Executive Summary: 500-800 words, persuasive with win themes
- Company Overview: 400-600 words with key capabilities
- Qualifications: 500-800 words with evidence
- Technical Approach: 600-1000 words with methodology
- Timeline: Clear phases and milestones with durations
- Compliance Matrix: Minimum 5 detailed requirement-response pairs
- Optional sections can be shorter (200-400 words) but must be substantive`;
  }

  /**
   * Get system prompt based on quality level
   */
  private getSystemPrompt(qualityLevel: ProposalQualityLevel): string {
    const isPremium = ['premium', 'maximum'].includes(qualityLevel);

    return `You are an elite government proposal writer with 20+ years of experience winning competitive RFP contracts. You have a deep understanding of:
- Federal, state, and municipal procurement processes
- FAR/DFAR regulations and compliance requirements
- Persuasive proposal writing techniques
- Evaluation criteria and how proposals are scored
- Government contracting terminology and expectations

${isPremium ? `
For this PREMIUM quality proposal:
- Apply advanced proposal strategy techniques
- Incorporate win themes throughout all sections
- Use the "ghost" technique to subtly highlight competitor weaknesses
- Ensure every paragraph advances a win strategy
- Create compelling discriminators that are memorable
- Write to maximize evaluation scores on every criteria
` : `
For this STANDARD quality proposal:
- Write clear, compliant, and professional content
- Address all requirements directly
- Highlight key strengths and qualifications
- Maintain consistency across all sections
`}

IMPORTANT:
- Return ONLY valid JSON matching the requested schema
- NEVER use placeholder text - generate actual substantive content
- Each section must be detailed, specific, and directly relevant
- Maintain factual consistency across all sections`;
  }

  /**
   * Format company information for the prompt
   */
  private formatCompanyInformation(
    mapping: CompanyDataMapping | DefaultCompanyMappingConfig
  ): string {
    return `
COMPANY PROFILE:
Name: ${mapping.profile.companyName}
DBA: ${mapping.profile.dba || 'N/A'}
Business Type: ${mapping.profile.primaryBusinessCategory || 'Not specified'}
NAICS: ${mapping.businessClassifications.naics.join(', ') || 'Not specified'}
NIGP Codes: ${mapping.businessClassifications.nigp.join(', ') || 'Not specified'}
Website: ${mapping.profile.website || 'Not provided'}

CERTIFICATIONS:
${mapping.relevantCertifications
  .map(
    cert =>
      `- ${cert.certificationType}: ${cert.certificationNumber} (Expires: ${cert.expirationDate})`
  )
  .join('\n')}

SOCIO-ECONOMIC QUALIFICATIONS:
- Small Business: ${mapping.socioEconomicQualifications.smallBusiness ? 'Yes' : 'No'}
- Woman-Owned: ${mapping.socioEconomicQualifications.womanOwned ? 'Yes' : 'No'}
- Minority-Owned: ${mapping.socioEconomicQualifications.minorityOwned ? 'Yes' : 'No'}
- HUBZone: ${mapping.socioEconomicQualifications.hubZone ? 'Yes' : 'No'}

ASSIGNED CONTACTS:
${mapping.assignedContacts
  .map(assignment => {
    const contactName =
      'name' in assignment.contact
        ? assignment.contact.name
        : `${assignment.contact.firstName} ${assignment.contact.lastName}`;
    const contactEmail =
      'email' in assignment.contact
        ? assignment.contact.email
        : assignment.contact.emailAddress;
    return `- ${assignment.role}: ${contactName} (${contactEmail})`;
  })
  .join('\n')}

INSURANCE COVERAGE:
${mapping.applicableInsurance
  .map(ins => `- ${ins.insuranceType}: $${ins.coverageAmount} (${ins.carrier})`)
  .join('\n')}
    `;
  }

  /**
   * Build company facts section
   */
  private buildCompanyFacts(
    mapping: CompanyDataMapping | DefaultCompanyMappingConfig
  ): string {
    const facts = ['KEY COMPANY FACTS TO INCORPORATE:'];

    facts.push(`- Company Name: ${mapping.profile.companyName}`);

    const ownershipTypes = [];
    if (mapping.socioEconomicQualifications.smallBusiness)
      ownershipTypes.push('Small Business');
    if (mapping.socioEconomicQualifications.womanOwned)
      ownershipTypes.push('Woman-Owned (WBENC Certified)');
    if (mapping.socioEconomicQualifications.minorityOwned)
      ownershipTypes.push('Minority-Owned');
    if (mapping.socioEconomicQualifications.veteranOwned)
      ownershipTypes.push('Veteran-Owned');
    if (ownershipTypes.length > 0) {
      facts.push(`- Business Classifications: ${ownershipTypes.join(', ')}`);
    }

    const dunsIdentifier = mapping.identifiers.find(
      id => id.identifierType === 'duns'
    );
    if (dunsIdentifier) {
      facts.push(`- DUNS Number: ${dunsIdentifier.identifierValue}`);
    }

    if (mapping.relevantCertifications.length > 0) {
      const certTypes = mapping.relevantCertifications
        .map(cert => `${cert.certificationType} (${cert.certificationNumber})`)
        .join(', ');
      facts.push(`- Active Certifications: ${certTypes}`);
    }

    if (mapping.profile.primaryBusinessCategory) {
      facts.push(`- Primary Expertise: ${mapping.profile.primaryBusinessCategory}`);
    }

    const owner = mapping.assignedContacts.find(
      c => c.role === 'Business Owner'
    );
    if (owner) {
      const contactName =
        'name' in owner.contact
          ? owner.contact.name
          : `${owner.contact.firstName} ${owner.contact.lastName}`;
      facts.push(`- Company President/Owner: ${contactName}`);
    }

    const primaryAddress = mapping.addresses.find(
      addr => addr.type === 'primary_mailing' || addr.type === 'physical'
    );
    if (primaryAddress) {
      const addressLine = primaryAddress.line2
        ? `${primaryAddress.line1}, ${primaryAddress.line2}, ${primaryAddress.city}, ${primaryAddress.state} ${primaryAddress.zipCode}`
        : `${primaryAddress.line1}, ${primaryAddress.city}, ${primaryAddress.state} ${primaryAddress.zipCode}`;
      facts.push(`- Business Address: ${addressLine}`);
    }

    return facts.join('\n');
  }

  /**
   * Extract JSON from response that may be wrapped in markdown code blocks
   */
  private extractJSON(text: string): string {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }
    // Otherwise assume the whole text is JSON
    return text.trim();
  }

  /**
   * Get available quality levels with descriptions and pricing info
   */
  getQualityLevels(): Array<{
    level: ProposalQualityLevel;
    name: string;
    description: string;
    model: string;
    thinkingBudget: number | null;
    estimatedCost: string;
    estimatedTime: string;
  }> {
    return [
      {
        level: 'fast',
        name: 'Quick Draft',
        description: 'Fast generation for initial drafts and previews. No extended thinking.',
        model: 'Claude Sonnet 4.5',
        thinkingBudget: null,
        estimatedCost: '$0.10-0.30',
        estimatedTime: '15-30 seconds',
      },
      {
        level: 'standard',
        name: 'Standard',
        description: 'Balanced quality for routine proposals. Uses extended thinking for better reasoning.',
        model: 'Claude Sonnet 4.5',
        thinkingBudget: 10000,
        estimatedCost: '$0.50-1.00',
        estimatedTime: '1-2 minutes',
      },
      {
        level: 'enhanced',
        name: 'Enhanced',
        description: 'Higher quality for important RFPs. Extended thinking with larger budget.',
        model: 'Claude Sonnet 4.5',
        thinkingBudget: 16000,
        estimatedCost: '$1.00-2.00',
        estimatedTime: '2-4 minutes',
      },
      {
        level: 'premium',
        name: 'Premium',
        description: 'Premium quality using Opus 4.5 for high-value contracts. Comprehensive analysis.',
        model: 'Claude Opus 4.5',
        thinkingBudget: 24000,
        estimatedCost: '$5.00-10.00',
        estimatedTime: '4-8 minutes',
      },
      {
        level: 'maximum',
        name: 'Maximum',
        description: 'Maximum quality for critical, high-stakes RFPs. Opus 4.5 with full thinking capability.',
        model: 'Claude Opus 4.5',
        thinkingBudget: 32000,
        estimatedCost: '$10.00-20.00',
        estimatedTime: '8-15 minutes',
      },
    ];
  }
}

// Export singleton instance
export const claudeProposalService = new ClaudeProposalService();
