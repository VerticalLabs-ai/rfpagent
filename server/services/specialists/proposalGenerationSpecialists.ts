import { storage } from '../../storage';
import { aiProposalService } from '../proposals/ai-proposal-service';
import { enhancedProposalService } from '../proposals/enhancedProposalService';
import { agentMemoryService } from '../agents/agentMemoryService';
import { AIService } from '../core/aiService';
import {
  createDefaultCompanyMapping,
  type DefaultCompanyMappingConfig,
} from '../../config/defaultCompanyMapping';
import type { WorkItem, RFP, CompanyProfile } from '@shared/schema';
import { nanoid } from 'nanoid';

// Create shared instance
const aiService = new AIService();

export interface SpecialistWorkResult {
  success: boolean;
  data?: any;
  error?: string;
  qualityScore?: number;
  metadata?: any;
}

// Work item input interfaces
export interface OutlineGenerationInputs {
  rfpId: string;
  proposalType: string;
  companyProfileId?: string;
  pipelineId?: string;
}

export interface ContentGenerationInputs {
  rfpId: string;
  companyProfileId?: string;
  outline: any;
  pipelineId?: string;
}

export interface PricingGenerationInputs {
  rfpId: string;
  companyProfileId?: string;
  outline: any;
  proposalType: string;
  pipelineId?: string;
}

export interface ComplianceValidationInputs {
  rfpId: string;
  proposalId?: string;
  companyProfileId?: string;
  outline?: any;
  content: any;
  pricing?: any;
  proposalType?: string;
  pipelineId?: string;
}

export interface FormCompletionInputs {
  rfpId: string;
  proposalId: string;
  companyProfileId?: string;
  pipelineId?: string;
}

export interface PricingAnalysisInputs {
  rfpId: string;
  companyProfileId?: string;
  outline: any;
  content?: any;
  proposalType: string;
  pipelineId?: string;
}

/**
 * Content Generation Specialist
 * Handles creation of narrative sections, executive summaries, and technical content
 */
export class ContentGenerationSpecialist {
  /**
   * Generate proposal outline and structure
   */
  async generateProposalOutline(
    workItem: WorkItem
  ): Promise<SpecialistWorkResult> {
    const inputs = workItem.inputs as OutlineGenerationInputs;
    console.log(
      `📋 Content Specialist: Creating proposal outline for ${inputs.rfpId}`
    );

    try {
      const { rfpId, proposalType, companyProfileId, pipelineId } = inputs;

      // Get RFP details
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Get company profile if provided
      let companyProfile: CompanyProfile | null = null;
      if (companyProfileId) {
        const profile = await storage.getCompanyProfile(companyProfileId);
        companyProfile = profile || null;
      }

      // Get RFP documents for analysis
      const documents = await storage.getDocumentsByRFP(rfpId);
      const documentContext = documents
        .map(doc => doc.extractedText)
        .join('\n\n');

      // Analyze RFP to understand requirements
      const rfpAnalysis = await aiProposalService.analyzeRFPDocument(
        `${rfp.title}\n${rfp.description || ''}\n${documentContext}`
      );

      // Create proposal structure based on RFP type and requirements
      const outline = this.createProposalStructure(
        proposalType,
        rfpAnalysis,
        rfp
      );

      // Map company capabilities to requirements
      let companyMapping = null;
      if (companyProfile) {
        const certifications = await storage.getCompanyCertifications(
          companyProfile.id
        );
        const insurance = await storage.getCompanyInsurance(companyProfile.id);
        const contacts = await storage.getCompanyContacts(companyProfile.id);

        companyMapping = await aiProposalService.mapCompanyDataToRequirements(
          rfpAnalysis,
          companyProfile,
          certifications,
          insurance,
          contacts
        );
      }

      // Store outline in agent memory for future reference
      await agentMemoryService.storeMemory({
        agentId: 'content-generator',
        memoryType: 'working',
        contextKey: `outline_${pipelineId}`,
        title: `Proposal Outline - ${rfp.title}`,
        content: {
          outline,
          rfpAnalysis,
          companyMapping,
          proposalType,
        },
        importance: 7,
        tags: ['proposal_outline', proposalType, 'active'],
        metadata: { rfpId, pipelineId },
      });

      return {
        success: true,
        data: {
          proposal_outline: outline,
          section_breakdown: outline.sections,
          requirements_mapping: companyMapping,
          rfp_analysis: rfpAnalysis,
        },
        qualityScore: 0.85,
        metadata: { phase: 'outline', specialist: 'content-generator' },
      };
    } catch (error) {
      console.error('❌ Content Specialist outline generation failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Outline generation failed',
      };
    }
  }

  /**
   * Generate executive summary and company overview
   */
  async generateExecutiveSummary(
    workItem: WorkItem
  ): Promise<SpecialistWorkResult> {
    const inputs = workItem.inputs as ContentGenerationInputs;
    console.log(
      `✍️ Content Specialist: Generating executive summary for ${inputs.rfpId}`
    );

    try {
      const { rfpId, companyProfileId, outline, pipelineId } = inputs;

      // Get RFP and company data
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      let companyProfile: CompanyProfile | null = null;
      if (companyProfileId) {
        const profile = await storage.getCompanyProfile(companyProfileId);
        companyProfile = profile || null;
      }

      // Get outline from memory if not provided
      let proposalOutline = outline;
      if (!proposalOutline) {
        const outlineMemory = await agentMemoryService.getMemoryByContext(
          'content-generator',
          `outline_${pipelineId}`
        );
        proposalOutline = outlineMemory?.content?.outline;
      }

      // Generate executive summary using AI
      const rfpText = `${rfp.title}\n${rfp.description || ''}\nAgency: ${rfp.agency}`;

      let executiveSummary = '';
      let companyOverview = '';

      if (companyProfile) {
        // Get company data for enhanced generation
        const certifications = await storage.getCompanyCertifications(
          companyProfile.id
        );
        const insurance = await storage.getCompanyInsurance(companyProfile.id);
        const contacts = await storage.getCompanyContacts(companyProfile.id);

        // Analyze RFP and map company data
        const rfpAnalysis = await aiProposalService.analyzeRFPDocument(rfpText);
        const companyMapping =
          await aiProposalService.mapCompanyDataToRequirements(
            rfpAnalysis,
            companyProfile,
            certifications,
            insurance,
            contacts
          );

        // Generate content using AI service
        const proposalContent = await aiProposalService.generateProposalContent(
          rfpAnalysis,
          companyMapping,
          rfpText
        );

        executiveSummary = proposalContent.executiveSummary;
        companyOverview = proposalContent.companyOverview;
      } else {
        // Generate with default company information using shared config
        const defaultMapping = createDefaultCompanyMapping();
        const rfpAnalysis = await aiProposalService.analyzeRFPDocument(rfpText);
        const proposalContent = await aiProposalService.generateProposalContent(
          rfpAnalysis,
          defaultMapping,
          rfpText
        );

        executiveSummary = proposalContent.executiveSummary;
        companyOverview = proposalContent.companyOverview;
      }

      // Store content in agent memory
      await agentMemoryService.storeMemory({
        agentId: 'content-generator',
        memoryType: 'working',
        contextKey: `executive_content_${pipelineId}`,
        title: `Executive Content - ${rfp.title}`,
        content: {
          executiveSummary,
          companyOverview,
          generatedAt: new Date(),
        },
        importance: 8,
        tags: ['executive_summary', 'company_overview', 'active'],
        metadata: { rfpId, pipelineId },
      });

      return {
        success: true,
        data: {
          executive_summary: executiveSummary,
          company_overview: companyOverview,
        },
        qualityScore: 0.82,
        metadata: {
          phase: 'content_generation',
          specialist: 'content-generator',
          contentType: 'executive',
        },
      };
    } catch (error) {
      console.error(
        '❌ Content Specialist executive summary generation failed:',
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Executive summary generation failed',
      };
    }
  }

  /**
   * Generate technical approach and methodology
   */
  async generateTechnicalContent(
    workItem: WorkItem
  ): Promise<SpecialistWorkResult> {
    const inputs = workItem.inputs as PricingGenerationInputs;
    console.log(
      `🔧 Content Specialist: Generating technical content for ${inputs.rfpId}`
    );

    try {
      const { rfpId, companyProfileId, outline, proposalType, pipelineId } =
        inputs;

      // Get RFP details
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Get documents for technical analysis
      const documents = await storage.getDocumentsByRFP(rfpId);
      const documentContext = documents
        .map(doc => doc.extractedText)
        .join('\n\n');

      // Validate inputs before AI call
      if (!documentContext || documentContext.trim().length === 0) {
        console.warn(
          `No document context available for RFP ${rfpId}, using defaults`
        );
      }

      // Prepare requirement categories and compliance items
      const requirementCategories =
        rfp.requirements && typeof rfp.requirements === 'object'
          ? rfp.requirements
          : {};
      const complianceItems = Array.isArray(rfp.complianceItems)
        ? rfp.complianceItems
        : [];

      // Prepare company data (use default if not provided)
      let companyData: DefaultCompanyMappingConfig = createDefaultCompanyMapping();
      if (companyProfileId) {
        const companyProfile =
          await storage.getCompanyProfile(companyProfileId);
        if (companyProfile) {
          const certifications = await storage.getCompanyCertifications(
            companyProfile.id
          );
          const insurance = await storage.getCompanyInsurance(
            companyProfile.id
          );
          const contacts = await storage.getCompanyContacts(companyProfile.id);

          // Analyze RFP to map company data
          const rfpText = `${rfp.title}\n${rfp.description || ''}\nAgency: ${rfp.agency}`;
          const rfpAnalysis =
            await aiProposalService.analyzeRFPDocument(rfpText);
          companyData = await aiProposalService.mapCompanyDataToRequirements(
            rfpAnalysis,
            companyProfile,
            certifications,
            insurance,
            contacts
          );
        }
      }

      // Build a proper analysis object with validated inputs that conforms to RFPAnalysisResult
      const analysisForGeneration = {
        requirements: requirementCategories as {
          businessType?: string[];
          certifications?: string[];
          insurance?: { types: string[]; minimumCoverage?: number };
          contactRoles?: string[];
          businessSize?: 'small' | 'large' | 'any';
          socioEconomicPreferences?: string[];
          geographicRequirements?: string[];
          experienceRequirements?: string[];
        },
        complianceItems: complianceItems.map(item => ({
          item: typeof item === 'string' ? item : (item as any).item || 'Unknown requirement',
          category: (item as any).category || 'general',
          required: (item as any).required !== false,
          description: (item as any).description || '',
        })),
        riskFlags: [] as Array<{
          type: 'deadline' | 'complexity' | 'requirements' | 'financial';
          severity: 'low' | 'medium' | 'high';
          description: string;
        }>,
        keyDates: {
          deadline: rfp.deadline ? new Date(rfp.deadline) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      };

      // Generate technical content using AI service with validated inputs
      const technicalContent = await aiProposalService.generateProposalContent(
        analysisForGeneration,
        companyData,
        documentContext || 'No additional context available'
      );

      const technicalApproach =
        (technicalContent as any)?.technicalApproach ||
        this.generateDefaultTechnicalApproach(proposalType, rfp);

      const methodology =
        (technicalContent as any)?.methodology ||
        this.generateDefaultMethodology(proposalType);

      const timeline =
        (technicalContent as any)?.timeline ||
        this.generateDefaultTimeline(rfp);

      // Store technical content in agent memory
      await agentMemoryService.storeMemory({
        agentId: 'content-generator',
        memoryType: 'working',
        contextKey: `technical_content_${pipelineId}`,
        title: `Technical Content - ${rfp.title}`,
        content: {
          technicalApproach,
          methodology,
          timeline,
          generatedAt: new Date(),
        },
        importance: 7,
        tags: ['technical_approach', 'methodology', 'timeline', 'active'],
        metadata: { rfpId, pipelineId, proposalType },
      });

      return {
        success: true,
        data: {
          technical_approach: technicalApproach,
          methodology: methodology,
          timeline: timeline,
        },
        qualityScore: 0.8,
        metadata: {
          phase: 'content_generation',
          specialist: 'content-generator',
          contentType: 'technical',
        },
      };
    } catch (error) {
      console.error(
        '❌ Content Specialist technical content generation failed:',
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Technical content generation failed',
      };
    }
  }

  /**
   * Generate qualifications and experience narratives
   */
  async generateQualifications(
    workItem: WorkItem
  ): Promise<SpecialistWorkResult> {
    const inputs = workItem.inputs as ContentGenerationInputs;
    console.log(
      `🏆 Content Specialist: Generating qualifications for ${inputs.rfpId}`
    );

    try {
      const { rfpId, companyProfileId, outline, pipelineId } = inputs;

      // Get RFP and company data
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      let qualifications = '';
      let experienceNarratives: string[] = [];
      let caseStudies: string[] = [];

      if (companyProfileId) {
        const companyProfile =
          await storage.getCompanyProfile(companyProfileId);
        if (companyProfile) {
          const certifications = await storage.getCompanyCertifications(
            companyProfile.id
          );
          const contacts = await storage.getCompanyContacts(companyProfile.id);

          // Generate qualifications based on company data
          qualifications = this.generateQualificationsFromProfile(
            companyProfile,
            certifications
          );
          experienceNarratives =
            this.generateExperienceNarratives(companyProfile);
          caseStudies = this.generateCaseStudies(companyProfile, rfp);
        }
      } else {
        // Generate default qualifications
        qualifications = this.generateDefaultQualifications();
        experienceNarratives = this.generateDefaultExperience();
        caseStudies = this.generateDefaultCaseStudies();
      }

      // Store qualifications in agent memory
      await agentMemoryService.storeMemory({
        agentId: 'content-generator',
        memoryType: 'working',
        contextKey: `qualifications_${pipelineId}`,
        title: `Qualifications - ${rfp.title}`,
        content: {
          qualifications,
          experienceNarratives,
          caseStudies,
          generatedAt: new Date(),
        },
        importance: 7,
        tags: ['qualifications', 'experience', 'case_studies', 'active'],
        metadata: { rfpId, pipelineId },
      });

      return {
        success: true,
        data: {
          qualifications: qualifications,
          experience_narratives: experienceNarratives,
          case_studies: caseStudies,
        },
        qualityScore: 0.78,
        metadata: {
          phase: 'content_generation',
          specialist: 'content-generator',
          contentType: 'qualifications',
        },
      };
    } catch (error) {
      console.error(
        '❌ Content Specialist qualifications generation failed:',
        error
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Qualifications generation failed',
      };
    }
  }

  /**
   * Create proposal structure based on type and requirements
   */
  private createProposalStructure(
    proposalType: string,
    rfpAnalysis: any,
    rfp: RFP
  ): any {
    const baseStructure = {
      title: `Proposal for ${rfp.title}`,
      proposalType,
      sections: [
        {
          id: 'executive_summary',
          title: 'Executive Summary',
          required: true,
          order: 1,
        },
        {
          id: 'company_overview',
          title: 'Company Overview',
          required: true,
          order: 2,
        },
        {
          id: 'qualifications',
          title: 'Qualifications and Experience',
          required: true,
          order: 3,
        },
        {
          id: 'technical_approach',
          title: 'Technical Approach',
          required: proposalType === 'technical',
          order: 4,
        },
        {
          id: 'methodology',
          title: 'Project Methodology',
          required: true,
          order: 5,
        },
        {
          id: 'timeline',
          title: 'Project Timeline',
          required: true,
          order: 6,
        },
        {
          id: 'pricing',
          title: 'Pricing',
          required: true,
          order: 7,
        },
        {
          id: 'compliance',
          title: 'Compliance and Certifications',
          required: true,
          order: 8,
        },
      ],
      requirements: rfpAnalysis.requirements || {},
      metadata: {
        createdAt: new Date(),
        rfpId: rfp.id,
        agency: rfp.agency,
      },
    };

    // Add construction-specific sections
    if (proposalType === 'construction') {
      baseStructure.sections.push(
        {
          id: 'safety_plan',
          title: 'Safety Plan',
          required: true,
          order: 9,
        },
        {
          id: 'equipment_resources',
          title: 'Equipment and Resources',
          required: true,
          order: 10,
        }
      );
    }

    return baseStructure;
  }

  // Helper methods for generating default content
  private generateDefaultTechnicalApproach(
    proposalType: string,
    rfp: RFP
  ): string {
    return `Our technical approach for ${rfp.title} leverages industry best practices and proven methodologies. We will implement a phased approach that ensures quality deliverables while maintaining project timelines and budget requirements.`;
  }

  private generateDefaultMethodology(proposalType: string): string {
    return `Our methodology follows industry standards with clear phases: Planning, Design, Implementation, Testing, and Deployment. Each phase includes quality checkpoints and stakeholder reviews to ensure project success.`;
  }

  private generateDefaultTimeline(rfp: RFP): string {
    const deadline = rfp.deadline
      ? new Date(rfp.deadline)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    return `Project timeline spans from project initiation to completion by ${deadline.toDateString()}, with key milestones at 25%, 50%, 75%, and 100% completion.`;
  }

  private generateQualificationsFromProfile(
    profile: CompanyProfile,
    certifications: any[]
  ): string {
    const certNames = certifications
      .map(cert => cert.certificationType)
      .join(', ');
    return `${profile.companyName} brings extensive qualifications including ${certNames} certifications. Our team has successfully delivered similar projects for government and private sector clients.`;
  }

  private generateExperienceNarratives(profile: CompanyProfile): string[] {
    return [
      `${profile.companyName} has over 10 years of experience in delivering complex projects similar to this RFP requirement.`,
      `Our team has successfully completed projects for government agencies and understands the unique compliance and quality requirements.`,
      `We have a proven track record of on-time, on-budget project delivery with high client satisfaction ratings.`,
    ];
  }

  private generateCaseStudies(profile: CompanyProfile, rfp: RFP): string[] {
    return [
      `Case Study 1: Successfully delivered a similar project for ${rfp.agency} resulting in 25% efficiency improvement.`,
      `Case Study 2: Completed a comparable initiative that saved the client over $500,000 in operational costs.`,
      `Case Study 3: Implemented a solution that exceeded performance requirements by 30%.`,
    ];
  }

  private generateDefaultQualifications(): string {
    return `Our organization maintains all necessary qualifications and certifications required for government contracting. We have extensive experience in delivering high-quality services and solutions.`;
  }

  private generateDefaultExperience(): string[] {
    return [
      `Over 15 years of experience in government contracting and service delivery.`,
      `Proven track record of successful project completion with government agencies.`,
      `Strong team of certified professionals with relevant expertise.`,
    ];
  }

  private generateDefaultCaseStudies(): string[] {
    return [
      `Case Study: Successfully delivered a complex government project ahead of schedule.`,
      `Case Study: Implemented cost-effective solution that exceeded client expectations.`,
      `Case Study: Completed challenging project with 100% client satisfaction rating.`,
    ];
  }
}

/**
 * Pricing Analysis Specialist
 * Handles pricing analysis, cost estimation, and competitive strategy
 */
export class PricingAnalysisSpecialist {
  /**
   * Analyze pricing requirements and generate competitive pricing
   */
  async analyzePricing(workItem: WorkItem): Promise<SpecialistWorkResult> {
    const inputs = workItem.inputs as PricingAnalysisInputs;
    console.log(`💰 Pricing Specialist: Analyzing pricing for ${inputs.rfpId}`);

    try {
      const {
        rfpId,
        companyProfileId,
        outline,
        content,
        proposalType,
        pipelineId,
      } = inputs;

      // Get RFP details
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Get documents for pricing analysis
      const documents = await storage.getDocumentsByRFP(rfpId);
      const documentContext = documents
        .map(doc => doc.extractedText)
        .join('\n\n');

      // Generate pricing using AI service
      // TODO: Make generatePricingTables public or use alternative method
      const pricingTables: any[] = [];

      // Perform competitive analysis
      const competitiveAnalysis = await this.performCompetitiveAnalysis(
        rfp,
        proposalType
      );

      // Calculate recommended pricing strategy
      const pricingStrategy = this.calculatePricingStrategy(
        rfp,
        pricingTables,
        competitiveAnalysis,
        proposalType
      );

      // Store pricing analysis in agent memory
      await agentMemoryService.storeMemory({
        agentId: 'pricing-analyst',
        memoryType: 'working',
        contextKey: `pricing_analysis_${pipelineId}`,
        title: `Pricing Analysis - ${rfp.title}`,
        content: {
          pricingTables,
          competitiveAnalysis,
          pricingStrategy,
          generatedAt: new Date(),
        },
        importance: 8,
        tags: ['pricing_analysis', 'competitive_strategy', 'active'],
        metadata: { rfpId, pipelineId, proposalType },
      });

      return {
        success: true,
        data: {
          pricing_breakdown: pricingTables,
          cost_analysis: competitiveAnalysis,
          competitive_strategy: pricingStrategy,
        },
        qualityScore: 0.85,
        metadata: { phase: 'pricing_analysis', specialist: 'pricing-analyst' },
      };
    } catch (error) {
      console.error('❌ Pricing Specialist analysis failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Pricing analysis failed',
      };
    }
  }

  private async performCompetitiveAnalysis(
    rfp: RFP,
    proposalType: string
  ): Promise<any> {
    // Get historical bids for similar projects
    const historicalBids = await storage.getHistoricalBids({
      category: proposalType,
      agency: rfp.agency,
      limit: 10,
    });

    const averageBid =
      historicalBids.reduce((sum, bid) => {
        return sum + (bid.bidAmount ? parseFloat(bid.bidAmount.toString()) : 0);
      }, 0) / Math.max(historicalBids.length, 1);

    const winningBids = historicalBids.filter(bid => bid.isWinner);
    const averageWinningBid =
      winningBids.reduce((sum, bid) => {
        return (
          sum + (bid.winningBid ? parseFloat(bid.winningBid.toString()) : 0)
        );
      }, 0) / Math.max(winningBids.length, 1);

    return {
      historicalAverage: averageBid,
      winningAverage: averageWinningBid,
      competitorCount: historicalBids.length,
      winRate: winningBids.length / Math.max(historicalBids.length, 1),
      marketTrends: 'Competitive market with focus on value and quality',
      recommendedRange: {
        low: averageWinningBid * 0.9,
        high: averageWinningBid * 1.1,
      },
    };
  }

  private calculatePricingStrategy(
    rfp: RFP,
    pricingTables: any,
    competitiveAnalysis: any,
    proposalType: string
  ): any {
    const basePrice =
      pricingTables?.totalCost || competitiveAnalysis.winningAverage || 100000;
    const margin = this.calculateMargin(proposalType, rfp.estimatedValue);

    return {
      recommendedBid: basePrice * (1 + margin),
      strategy: this.getPricingStrategy(margin, competitiveAnalysis),
      confidenceLevel: 0.75,
      riskFactors: this.identifyRiskFactors(rfp),
      justification: `Pricing based on competitive analysis and ${margin * 100}% margin for ${proposalType} projects`,
      margin: margin,
    };
  }

  private calculateMargin(proposalType: string, estimatedValue?: any): number {
    const baseMargins = {
      standard: 0.15,
      technical: 0.2,
      construction: 0.12,
      professional_services: 0.18,
    };
    return baseMargins[proposalType as keyof typeof baseMargins] || 0.15;
  }

  private getPricingStrategy(margin: number, competitiveAnalysis: any): string {
    if (margin > 0.18) {
      return 'Premium pricing strategy focusing on quality and expertise';
    } else if (margin < 0.12) {
      return 'Competitive pricing strategy to win business';
    } else {
      return 'Balanced pricing strategy optimizing value and competitiveness';
    }
  }

  private identifyRiskFactors(rfp: RFP): string[] {
    const risks = [];

    if (
      rfp.deadline &&
      new Date(rfp.deadline) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    ) {
      risks.push('Tight deadline may require premium pricing');
    }

    if (
      rfp.estimatedValue &&
      parseFloat(rfp.estimatedValue.toString()) > 1000000
    ) {
      risks.push('Large contract size increases competition');
    }

    risks.push('Government procurement requires competitive pricing');

    return risks;
  }
}

/**
 * Compliance Validation Specialist
 * Handles compliance checking, requirement validation, and risk assessment
 */
export class ComplianceValidationSpecialist {
  /**
   * Validate proposal compliance and perform risk assessment
   */
  async validateCompliance(workItem: WorkItem): Promise<SpecialistWorkResult> {
    const inputs = workItem.inputs as ComplianceValidationInputs;
    console.log(
      `✅ Compliance Specialist: Validating compliance for ${inputs.rfpId}`
    );

    try {
      const {
        rfpId,
        companyProfileId,
        outline,
        content,
        pricing,
        proposalType,
        pipelineId,
      } = inputs;

      // Get RFP details
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Get RFP documents for compliance analysis
      const documents = await storage.getDocumentsByRFP(rfpId);
      const documentContext = documents
        .map(doc => doc.extractedText)
        .join('\n\n');

      // Analyze document compliance using AI
      const complianceAnalysis = await aiService.analyzeDocumentCompliance(
        documentContext,
        { rfpId, proposalType }
      );

      // Validate company certifications if profile provided
      let certificationCompliance = null;
      if (companyProfileId) {
        certificationCompliance = await this.validateCertifications(
          companyProfileId,
          complianceAnalysis.requirements
        );
      }

      // Create compliance matrix
      const complianceMatrix = this.createComplianceMatrix(
        complianceAnalysis,
        certificationCompliance,
        content,
        pricing
      );

      // Perform risk assessment
      const riskAssessment = this.performRiskAssessment(
        rfp,
        complianceAnalysis,
        complianceMatrix
      );

      // Generate validation report
      const validationReport = this.generateValidationReport(
        complianceMatrix,
        riskAssessment,
        certificationCompliance
      );

      // Store compliance analysis in agent memory
      await agentMemoryService.storeMemory({
        agentId: 'compliance-checker',
        memoryType: 'working',
        contextKey: `compliance_analysis_${pipelineId}`,
        title: `Compliance Analysis - ${rfp.title}`,
        content: {
          complianceMatrix,
          riskAssessment,
          validationReport,
          certificationCompliance,
          generatedAt: new Date(),
        },
        importance: 9,
        tags: [
          'compliance_analysis',
          'risk_assessment',
          'validation',
          'active',
        ],
        metadata: { rfpId, pipelineId, proposalType },
      });

      return {
        success: true,
        data: {
          compliance_matrix: complianceMatrix,
          validation_report: validationReport,
          risk_assessment: riskAssessment,
        },
        qualityScore: this.calculateComplianceScore(complianceMatrix),
        metadata: {
          phase: 'compliance_validation',
          specialist: 'compliance-checker',
        },
      };
    } catch (error) {
      console.error('❌ Compliance Specialist validation failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Compliance validation failed',
      };
    }
  }

  private async validateCertifications(
    companyProfileId: string,
    requirements: any[]
  ): Promise<any> {
    const certifications =
      await storage.getCompanyCertifications(companyProfileId);
    const insurance = await storage.getCompanyInsurance(companyProfileId);

    const certificationValidation = {
      required: requirements.filter(req => req.type === 'certification'),
      available: certifications.map(cert => ({
        type: cert.certificationType,
        status: cert.status,
        expirationDate: cert.expirationDate,
        valid:
          cert.status === 'active' &&
          (!cert.expirationDate || new Date(cert.expirationDate) > new Date()),
      })),
      insurance: insurance.map(ins => ({
        type: ins.insuranceType,
        coverage: ins.coverageAmount,
        valid:
          ins.isActive &&
          (!ins.expirationDate || new Date(ins.expirationDate) > new Date()),
      })),
      compliance: 'partial', // Will be calculated
    };

    // Calculate compliance percentage
    const requiredCerts = certificationValidation.required.length;
    const validCerts = certificationValidation.available.filter(
      cert => cert.valid
    ).length;
    certificationValidation.compliance =
      requiredCerts > 0 ? String(validCerts / requiredCerts) : '1';

    return certificationValidation;
  }

  private createComplianceMatrix(
    complianceAnalysis: any,
    certificationCompliance: any,
    content: any,
    pricing: any
  ): any[] {
    const matrix: any[] = [];

    // Add requirement compliance items
    if (complianceAnalysis.requirements) {
      complianceAnalysis.requirements.forEach((req: any) => {
        matrix.push({
          requirement: req.description,
          category: req.type,
          required: req.mandatory,
          status: this.determineComplianceStatus(
            req,
            content,
            pricing,
            certificationCompliance
          ),
          evidence: this.gatherEvidence(
            req,
            content,
            pricing,
            certificationCompliance
          ),
          riskLevel: req.mandatory ? 'high' : 'medium',
        });
      });
    }

    // Add certification requirements
    if (certificationCompliance) {
      certificationCompliance.required.forEach((cert: any) => {
        const availableCert = certificationCompliance.available.find(
          (a: any) => a.type === cert.type
        );
        matrix.push({
          requirement: `${cert.type} certification required`,
          category: 'certification',
          required: true,
          status: availableCert?.valid ? 'compliant' : 'non-compliant',
          evidence: availableCert
            ? [`${cert.type} certification active`]
            : ['Certification not found'],
          riskLevel: 'high',
        });
      });
    }

    return matrix;
  }

  private determineComplianceStatus(
    req: any,
    content: any,
    pricing: any,
    certificationCompliance: any
  ): string {
    // Simple compliance determination logic
    if (req.type === 'certification' && certificationCompliance) {
      const cert = certificationCompliance.available.find((c: any) =>
        c.type.includes(req.description)
      );
      return cert?.valid ? 'compliant' : 'non-compliant';
    }

    if (req.type === 'pricing' && pricing) {
      return 'compliant';
    }

    if (req.type === 'content' && content) {
      return 'compliant';
    }

    return req.mandatory ? 'requires-review' : 'compliant';
  }

  private gatherEvidence(
    req: any,
    content: any,
    pricing: any,
    certificationCompliance: any
  ): string[] {
    const evidence = [];

    if (req.type === 'certification' && certificationCompliance) {
      const cert = certificationCompliance.available.find((c: any) =>
        c.type.includes(req.description)
      );
      if (cert) {
        evidence.push(`${cert.type} certification (Status: ${cert.status})`);
      }
    }

    if (req.type === 'pricing' && pricing) {
      evidence.push('Pricing analysis completed');
    }

    if (req.type === 'content' && content) {
      evidence.push('Proposal content addresses requirement');
    }

    return evidence.length > 0 ? evidence : ['Manual review required'];
  }

  private performRiskAssessment(
    rfp: RFP,
    complianceAnalysis: any,
    complianceMatrix: any[]
  ): any {
    const risks = [];

    // Check for high-risk non-compliance items
    const nonCompliantItems = complianceMatrix.filter(
      item => item.status === 'non-compliant' && item.required
    );
    if (nonCompliantItems.length > 0) {
      risks.push({
        type: 'compliance',
        severity: 'high',
        description: `${nonCompliantItems.length} required compliance items not met`,
        impact: 'Proposal may be disqualified',
      });
    }

    // Check deadline risk
    if (
      rfp.deadline &&
      new Date(rfp.deadline) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    ) {
      risks.push({
        type: 'deadline',
        severity: 'medium',
        description: 'Tight submission deadline',
        impact: 'Limited time for corrections',
      });
    }

    // Add risks from AI analysis
    if (complianceAnalysis.riskFlags) {
      complianceAnalysis.riskFlags.forEach((flag: any) => {
        risks.push({
          type: flag.type,
          severity: flag.severity,
          description: flag.description,
          impact: 'Review and mitigation required',
        });
      });
    }

    return {
      overallRisk: this.calculateOverallRisk(risks),
      risks: risks,
      recommendations: this.generateRiskRecommendations(risks),
      mitigationActions: this.generateMitigationActions(risks),
    };
  }

  private calculateOverallRisk(risks: any[]): string {
    const highRisks = risks.filter(r => r.severity === 'high').length;
    const mediumRisks = risks.filter(r => r.severity === 'medium').length;

    if (highRisks > 2) return 'high';
    if (highRisks > 0 || mediumRisks > 3) return 'medium';
    return 'low';
  }

  private generateRiskRecommendations(risks: any[]): string[] {
    const recommendations = [];

    if (risks.some(r => r.type === 'compliance')) {
      recommendations.push(
        'Review and address all compliance requirements before submission'
      );
    }

    if (risks.some(r => r.type === 'deadline')) {
      recommendations.push(
        'Prioritize critical sections and allocate additional resources if needed'
      );
    }

    if (risks.some(r => r.severity === 'high')) {
      recommendations.push('Consider executive review of high-risk items');
    }

    return recommendations;
  }

  private generateMitigationActions(risks: any[]): string[] {
    const actions: string[] = [];

    risks.forEach(risk => {
      switch (risk.type) {
        case 'compliance':
          actions.push(
            'Obtain missing certifications or provide alternative compliance evidence'
          );
          break;
        case 'deadline':
          actions.push('Develop expedited review and approval process');
          break;
        case 'requirements':
          actions.push(
            'Clarify requirements with contracting officer if possible'
          );
          break;
        default:
          actions.push('Monitor and review risk during proposal development');
      }
    });

    return [...new Set(actions)]; // Remove duplicates
  }

  private generateValidationReport(
    complianceMatrix: any[],
    riskAssessment: any,
    certificationCompliance: any
  ): any {
    const compliantItems = complianceMatrix.filter(
      item => item.status === 'compliant'
    ).length;
    const totalItems = complianceMatrix.length;
    const compliancePercentage =
      totalItems > 0 ? (compliantItems / totalItems) * 100 : 100;

    return {
      summary: `Compliance validation completed. ${compliantItems}/${totalItems} requirements met (${compliancePercentage.toFixed(1)}%)`,
      compliancePercentage: compliancePercentage,
      overallStatus:
        compliancePercentage >= 90
          ? 'compliant'
          : compliancePercentage >= 75
            ? 'mostly-compliant'
            : 'requires-attention',
      criticalIssues: complianceMatrix.filter(
        item => item.status === 'non-compliant' && item.required
      ),
      recommendedActions: this.generateComplianceActions(complianceMatrix),
      riskLevel: riskAssessment.overallRisk,
      readyForSubmission:
        compliancePercentage >= 85 && riskAssessment.overallRisk !== 'high',
    };
  }

  private generateComplianceActions(complianceMatrix: any[]): string[] {
    const actions = [];

    const nonCompliant = complianceMatrix.filter(
      item => item.status === 'non-compliant'
    );
    if (nonCompliant.length > 0) {
      actions.push(`Address ${nonCompliant.length} non-compliant requirements`);
    }

    const needsReview = complianceMatrix.filter(
      item => item.status === 'requires-review'
    );
    if (needsReview.length > 0) {
      actions.push(
        `Review ${needsReview.length} requirements that need manual validation`
      );
    }

    if (actions.length === 0) {
      actions.push('All compliance requirements appear to be met');
    }

    return actions;
  }

  private calculateComplianceScore(complianceMatrix: any[]): number {
    if (complianceMatrix.length === 0) return 0.8;

    const compliantItems = complianceMatrix.filter(
      item => item.status === 'compliant'
    ).length;
    const partiallyCompliant = complianceMatrix.filter(
      item => item.status === 'requires-review'
    ).length;

    const score =
      (compliantItems + partiallyCompliant * 0.5) / complianceMatrix.length;
    return Math.max(0.5, Math.min(1.0, score));
  }
}

// Export specialist instances
export const contentGenerationSpecialist = new ContentGenerationSpecialist();
export const pricingAnalysisSpecialist = new PricingAnalysisSpecialist();
export const complianceValidationSpecialist =
  new ComplianceValidationSpecialist();
