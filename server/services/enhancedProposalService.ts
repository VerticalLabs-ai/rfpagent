import { storage } from '../storage';
import { documentIntelligenceService, type DocumentAnalysisResult, type FormField, type HumanOversightItem } from './documentIntelligenceService';
import { AIProposalService } from './ai-proposal-service';
import type { RFP, CompanyProfile } from '@shared/schema';
import { nanoid } from 'nanoid';

export interface ProposalGenerationRequest {
  rfpId: string;
  companyProfileId?: string;
  generatePricing: boolean;
  autoSubmit: boolean;
}

export interface ProposalGenerationResult {
  proposalId: string;
  documentAnalysis: DocumentAnalysisResult;
  filledForms: FormField[];
  humanActionItems: HumanOversightItem[];
  nextSteps: string[];
  readyForSubmission: boolean;
  estimatedCompletionTime: string;
  competitiveBidSummary?: {
    recommendedBid: number;
    strategy: string;
    confidenceLevel: number;
  };
}

export class EnhancedProposalService {
  private aiProposalService: AIProposalService;

  constructor() {
    this.aiProposalService = new AIProposalService();
  }

  /**
   * Generate comprehensive proposal with intelligent document processing
   */
  async generateProposal(request: ProposalGenerationRequest): Promise<ProposalGenerationResult> {
    console.log(`🚀 Starting enhanced proposal generation for RFP: ${request.rfpId}`);

    // Get RFP details
    const rfp = await storage.getRFP(request.rfpId);
    if (!rfp) {
      throw new Error(`RFP not found: ${request.rfpId}`);
    }

    // Update RFP status to indicate generation in progress
    await storage.updateRFP(request.rfpId, {
      status: 'drafting',
      progress: 20
    });

    console.log(`📊 Analyzing RFP documents for intelligent processing...`);

    // Step 1: Analyze all documents to identify fillable fields and requirements
    const documentAnalysis = await documentIntelligenceService.analyzeRFPDocuments(request.rfpId);
    console.log(`Found ${documentAnalysis.formFields.length} form fields and ${documentAnalysis.humanOversightItems.length} human oversight items`);

    await storage.updateRFP(request.rfpId, { progress: 40 });

    // Step 2: Auto-fill form fields with company data
    console.log(`🏢 Auto-filling forms with company data...`);
    const filledForms = await documentIntelligenceService.autoFillFormFields(
      request.rfpId,
      documentAnalysis.formFields,
      request.companyProfileId
    );

    await storage.updateRFP(request.rfpId, { progress: 60 });

    // Step 3: Generate AI proposal content for narrative sections
    console.log(`🤖 Generating AI proposal content...`);
    const proposalContent = await this.generateNarrativeContent(rfp, documentAnalysis, request.companyProfileId);

    await storage.updateRFP(request.rfpId, { progress: 80 });

    // Step 4: Create proposal record with all generated content
    const proposal = await storage.createProposal({
      rfpId: request.rfpId,
      content: proposalContent,
      forms: filledForms,
      pricingTables: documentAnalysis.competitiveBidAnalysis ? [{
        bidAmount: documentAnalysis.competitiveBidAnalysis.suggestedBidAmount,
        strategy: documentAnalysis.competitiveBidAnalysis.pricingStrategy,
        confidence: documentAnalysis.competitiveBidAnalysis.confidenceLevel,
        research: documentAnalysis.competitiveBidAnalysis.marketResearch
      }] : null,
      estimatedMargin: documentAnalysis.competitiveBidAnalysis ? 
        (((documentAnalysis.competitiveBidAnalysis.suggestedBidAmount * 0.15) / documentAnalysis.competitiveBidAnalysis.suggestedBidAmount * 100)).toString() : null,
      status: 'draft'
    });

    // Step 5: Create audit log
    await storage.createAuditLog({
      entityType: 'proposal',
      entityId: proposal.id,
      action: 'ai_generated',
      details: {
        formFieldsCount: filledForms.length,
        humanItemsCount: documentAnalysis.humanOversightItems.length,
        hasPricing: !!documentAnalysis.competitiveBidAnalysis,
        estimatedTime: documentAnalysis.estimatedCompletionTime
      }
    });

    // Step 6: Create notifications for human action items
    await this.createHumanOversightNotifications(documentAnalysis.humanOversightItems, request.rfpId);

    // Step 7: Determine next steps and readiness
    const { nextSteps, readyForSubmission } = this.determineNextSteps(
      filledForms,
      documentAnalysis.humanOversightItems,
      documentAnalysis.competitiveBidAnalysis
    );

    // Update RFP to completed status
    await storage.updateRFP(request.rfpId, {
      status: readyForSubmission ? 'review' : 'drafting',
      progress: 100
    });

    console.log(`✅ Proposal generation completed for RFP: ${rfp.title}`);

    return {
      proposalId: proposal.id,
      documentAnalysis,
      filledForms,
      humanActionItems: documentAnalysis.humanOversightItems,
      nextSteps,
      readyForSubmission,
      estimatedCompletionTime: documentAnalysis.estimatedCompletionTime,
      competitiveBidSummary: documentAnalysis.competitiveBidAnalysis ? {
        recommendedBid: documentAnalysis.competitiveBidAnalysis.suggestedBidAmount,
        strategy: documentAnalysis.competitiveBidAnalysis.pricingStrategy,
        confidenceLevel: documentAnalysis.competitiveBidAnalysis.confidenceLevel
      } : undefined
    };
  }

  /**
   * Generate narrative proposal content using AI
   */
  private async generateNarrativeContent(
    rfp: RFP,
    documentAnalysis: DocumentAnalysisResult,
    companyProfileId?: string
  ): Promise<any> {
    console.log(`📝 Generating narrative content for ${rfp.title}...`);

    // Get company profile for context
    let companyProfile: CompanyProfile | null = null;
    if (companyProfileId) {
      const profile = await storage.getCompanyProfile(companyProfileId);
      companyProfile = profile || null;
    }

    // Build context from document analysis
    const analysisContext = {
      formFieldsCount: documentAnalysis.formFields.length,
      requiresSignature: documentAnalysis.humanOversightItems.some(item => item.type === 'signature'),
      requiresPayment: documentAnalysis.humanOversightItems.some(item => item.type === 'payment'),
      hasPricingRequirements: documentAnalysis.formFields.some(field => field.category === 'pricing'),
      technicalRequirements: documentAnalysis.formFields.filter(field => field.category === 'technical').length,
      complianceRequirements: documentAnalysis.formFields.filter(field => field.category === 'compliance').length
    };

    // Generate proposal using existing AI service with enhanced context
    const rfpText = `${rfp.title}\n${rfp.description || ''}\nAgency: ${rfp.agency}`;
    
    try {
      const aiAnalysis = await this.aiProposalService.analyzeRFPDocument(rfpText);
      
      let proposalContent;
      if (companyProfile) {
        // Get additional company data for mapping
        const certifications = await storage.getCompanyCertifications(companyProfile.id);
        const insurance = await storage.getCompanyInsurance(companyProfile.id);
        const contacts = await storage.getCompanyContacts(companyProfile.id);
        
        const companyMapping = await this.aiProposalService.mapCompanyDataToRequirements(
          aiAnalysis, 
          companyProfile, 
          certifications, 
          insurance, 
          contacts
        );
        proposalContent = await this.aiProposalService.generateProposalContent(
          aiAnalysis,
          companyMapping,
          rfpText
        );
      } else {
        // Create a default company mapping if no profile provided
        const defaultMapping = {
          businessType: ['construction', 'technology'],
          certifications: ['WBENC', 'HUB', 'DBE', 'MBE', 'WBE'],
          companyInfo: {
            name: 'iByte Enterprises LLC',
            type: 'Woman-owned business',
            capabilities: ['construction', 'technology services']
          }
        };
        proposalContent = await this.aiProposalService.generateProposalContent(
          aiAnalysis,
          defaultMapping,
          rfpText
        );
      }

      return {
        ...proposalContent,
        analysisContext,
        generatedAt: new Date().toISOString(),
        processingInstructions: documentAnalysis.processingInstructions
      };
    } catch (error) {
      console.error('Error generating AI narrative content:', error);
      
      // Return basic content if AI fails
      return {
        executiveSummary: `iByte Enterprises LLC is pleased to submit our proposal for ${rfp.title}.`,
        technicalApproach: 'We will provide comprehensive services as outlined in the RFP requirements.',
        timeline: 'Project timeline will be established upon contract award.',
        qualifications: 'iByte Enterprises LLC is a certified woman-owned business with extensive experience in construction and technology services.',
        analysisContext,
        generatedAt: new Date().toISOString(),
        processingInstructions: documentAnalysis.processingInstructions
      };
    }
  }

  /**
   * Create notifications for human oversight items
   */
  private async createHumanOversightNotifications(
    humanItems: HumanOversightItem[],
    rfpId: string
  ): Promise<void> {
    for (const item of humanItems) {
      await storage.createNotification({
        type: 'compliance',
        title: `Human Action Required: ${item.type.replace('_', ' ').toUpperCase()}`,
        message: `${item.description}. Estimated time: ${item.estimatedTime}. Urgency: ${item.urgency.toUpperCase()}`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfpId
      });
    }
  }

  /**
   * Determine next steps and submission readiness
   */
  private determineNextSteps(
    filledForms: FormField[],
    humanItems: HumanOversightItem[],
    competitiveBidAnalysis?: any
  ): { nextSteps: string[]; readyForSubmission: boolean } {
    const nextSteps: string[] = [];
    let readyForSubmission = true;

    // Check for unfilled required fields
    const unfilledRequired = filledForms.filter(field => field.required && !field.value && field.type !== 'signature');
    if (unfilledRequired.length > 0) {
      nextSteps.push(`Review and complete ${unfilledRequired.length} required form fields`);
      readyForSubmission = false;
    }

    // Check for human oversight items
    const highPriorityItems = humanItems.filter(item => item.urgency === 'high');
    if (highPriorityItems.length > 0) {
      nextSteps.push(`Complete ${highPriorityItems.length} high-priority human action items`);
      readyForSubmission = false;
    }

    const mediumPriorityItems = humanItems.filter(item => item.urgency === 'medium');
    if (mediumPriorityItems.length > 0) {
      nextSteps.push(`Complete ${mediumPriorityItems.length} medium-priority human action items`);
    }

    // Check pricing completeness
    if (competitiveBidAnalysis && competitiveBidAnalysis.confidenceLevel < 0.7) {
      nextSteps.push('Review and validate competitive pricing analysis');
      readyForSubmission = false;
    }

    // Check for signatures needed
    const signaturesNeeded = humanItems.filter(item => item.type === 'signature').length;
    if (signaturesNeeded > 0) {
      nextSteps.push(`Obtain ${signaturesNeeded} required signature(s)`);
      readyForSubmission = false;
    }

    // Check for payments needed
    const paymentsNeeded = humanItems.filter(item => item.type === 'payment').length;
    if (paymentsNeeded > 0) {
      nextSteps.push(`Process ${paymentsNeeded} required payment(s)`);
      readyForSubmission = false;
    }

    // Default next steps if everything looks good
    if (nextSteps.length === 0) {
      nextSteps.push('Review generated proposal content');
      nextSteps.push('Verify all form fields are accurate');
      nextSteps.push('Prepare final submission');
    }

    return { nextSteps, readyForSubmission };
  }

  /**
   * Get proposal generation status
   */
  async getGenerationStatus(rfpId: string): Promise<{
    isGenerating: boolean;
    progress: number;
    currentStep: string;
    hasProposal: boolean;
  }> {
    const rfp = await storage.getRFP(rfpId);
    if (!rfp) {
      throw new Error(`RFP not found: ${rfpId}`);
    }

    const proposal = await storage.getProposalByRFP(rfpId);
    const hasProposal = !!proposal;

    let currentStep = 'Ready to generate';
    if (rfp.status === 'drafting') {
      if (rfp.progress < 40) currentStep = 'Analyzing documents';
      else if (rfp.progress < 60) currentStep = 'Auto-filling forms';
      else if (rfp.progress < 80) currentStep = 'Generating content';
      else currentStep = 'Finalizing proposal';
    }

    return {
      isGenerating: rfp.status === 'drafting',
      progress: rfp.progress,
      currentStep,
      hasProposal
    };
  }
}

export const enhancedProposalService = new EnhancedProposalService();