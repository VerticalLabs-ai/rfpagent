import { DocumentParsingService } from './documentParsingService';
import { DocumentIntelligenceService } from './documentIntelligenceService';
import { AIService } from './aiService';
import { storage } from '../storage';
import { agentMemoryService } from './agentMemoryService';
import { ObjectStorageService } from '../objectStorage';
import type { Document, RFP, WorkItem } from '@shared/schema';

/**
 * Analysis Specialists for the 3-Tier RFP Automation System
 * 
 * These specialist services integrate with existing DocumentParsingService and DocumentIntelligenceService
 * to provide specialized document processing capabilities within the agent system.
 */

export interface SpecialistTaskResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: any;
  nextActions?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  fileSize: number;
  fileType: string;
  readableContent: boolean;
  issues: string[];
  metadata: any;
}

export interface TextExtractionResult {
  extractedText: string;
  textLength: number;
  quality: 'high' | 'medium' | 'low';
  method: string;
  confidence: number;
  metadata: any;
}

export interface RequirementParsingResult {
  requirements: any[];
  mandatoryFields: any[];
  optionalFields: any[];
  evaluationCriteria: any[];
  deadlines: any[];
  categories: string[];
}

export interface ComplianceAnalysisResult {
  complianceItems: any[];
  riskFlags: any[];
  mandatoryChecklist: any[];
  confidenceScore: number;
  recommendations: string[];
}

/**
 * Document Processor Specialist
 * Handles document validation, OCR, and text extraction
 */
export class DocumentProcessorSpecialist {
  private documentParsingService = new DocumentParsingService();
  private objectStorageService = new ObjectStorageService();
  private agentId = 'document-processor';

  /**
   * Process document validation task
   */
  async processDocumentValidation(workItem: WorkItem): Promise<SpecialistTaskResult> {
    try {
      console.log(`📄 Document processor validating document: ${workItem.inputs.documentId}`);
      
      const documentId = workItem.inputs.documentId;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Validate document accessibility and integrity
      const validation = await this.validateDocument(document);
      
      // Store validation results
      await storage.updateDocument(documentId, {
        parsedData: {
          ...document.parsedData as any || {},
          validation
        }
      });

      // Store memory of validation
      await agentMemoryService.storeMemory({
        agentId: this.agentId,
        memoryType: 'episodic',
        contextKey: `document_validation_${documentId}`,
        title: `Document Validation: ${document.filename}`,
        content: {
          documentId,
          filename: document.filename,
          validation,
          processedAt: new Date()
        },
        importance: validation.isValid ? 7 : 9, // Higher importance for invalid docs
        metadata: {
          workItemId: workItem.id,
          rfpId: workItem.inputs.rfpId
        }
      });

      if (!validation.isValid) {
        return {
          success: false,
          error: `Document validation failed: ${validation.issues.join(', ')}`,
          metadata: { validation }
        };
      }

      return {
        success: true,
        result: validation,
        metadata: {
          documentId,
          filename: document.filename,
          validation
        },
        nextActions: ['text_extraction']
      };

    } catch (error) {
      console.error(`❌ Document validation failed:`, error);
      return {
        success: false,
        error: error.message,
        metadata: { workItemId: workItem.id }
      };
    }
  }

  /**
   * Process text extraction task
   */
  async processTextExtraction(workItem: WorkItem): Promise<SpecialistTaskResult> {
    try {
      console.log(`📝 Document processor extracting text: ${workItem.inputs.documentId}`);
      
      const documentId = workItem.inputs.documentId;
      const extractionMethod = workItem.inputs.extractionMethod || 'auto';
      const qualityLevel = workItem.inputs.qualityLevel || 'high';

      // Use existing document parsing service
      await this.documentParsingService.parseDocument(documentId);
      
      // Get updated document with extracted text
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      const extractionResult: TextExtractionResult = {
        extractedText: document.extractedText || '',
        textLength: document.extractedText?.length || 0,
        quality: this.assessTextQuality(document.extractedText || ''),
        method: extractionMethod,
        confidence: this.calculateExtractionConfidence(document.extractedText || '', document.fileType),
        metadata: {
          documentId,
          filename: document.filename,
          fileType: document.fileType,
          extractionMethod,
          qualityLevel,
          processedAt: new Date()
        }
      };

      // Store extraction memory
      await agentMemoryService.storeMemory({
        agentId: this.agentId,
        memoryType: 'procedural',
        contextKey: `text_extraction_${documentId}`,
        title: `Text Extraction: ${document.filename}`,
        content: {
          documentId,
          filename: document.filename,
          extractionResult,
          method: extractionMethod
        },
        importance: extractionResult.quality === 'high' ? 8 : 6,
        metadata: {
          workItemId: workItem.id,
          rfpId: workItem.inputs.rfpId
        }
      });

      // Update document with additional extraction metadata
      await storage.updateDocument(documentId, {
        parsedData: {
          ...document.parsedData as any || {},
          textExtraction: extractionResult
        }
      });

      return {
        success: true,
        result: extractionResult,
        metadata: {
          documentId,
          filename: document.filename,
          textLength: extractionResult.textLength,
          quality: extractionResult.quality
        },
        nextActions: ['requirement_parsing']
      };

    } catch (error) {
      console.error(`❌ Text extraction failed:`, error);
      return {
        success: false,
        error: error.message,
        metadata: { workItemId: workItem.id }
      };
    }
  }

  /**
   * Validate document integrity and accessibility
   */
  private async validateDocument(document: Document): Promise<ValidationResult> {
    const issues: string[] = [];
    let isValid = true;

    try {
      // Check if file exists in object storage
      const file = await this.objectStorageService.getObjectEntityFile(document.objectPath);
      if (!file) {
        issues.push('File not found in object storage');
        isValid = false;
      }

      // Check file type support
      const supportedTypes = ['pdf', 'docx', 'txt', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!supportedTypes.includes(document.fileType.toLowerCase())) {
        issues.push(`Unsupported file type: ${document.fileType}`);
        isValid = false;
      }

      // Estimate file size and content readability
      let fileSize = 0;
      let readableContent = true;

      if (file) {
        // Get file stats if available
        const stats = file.stat ? await file.stat() : null;
        fileSize = stats?.size || 0;

        // Check if file is too large (>50MB)
        if (fileSize > 50000000) {
          issues.push('File size exceeds maximum limit (50MB)');
          isValid = false;
        }

        // Check if file is too small (likely empty)
        if (fileSize < 100) {
          issues.push('File appears to be empty or corrupted');
          readableContent = false;
          isValid = false;
        }
      }

      return {
        isValid,
        fileSize,
        fileType: document.fileType,
        readableContent,
        issues,
        metadata: {
          documentId: document.id,
          filename: document.filename,
          validatedAt: new Date(),
          objectPath: document.objectPath
        }
      };

    } catch (error) {
      return {
        isValid: false,
        fileSize: 0,
        fileType: document.fileType,
        readableContent: false,
        issues: [`Validation error: ${error.message}`],
        metadata: {
          documentId: document.id,
          filename: document.filename,
          validatedAt: new Date(),
          error: error.message
        }
      };
    }
  }

  /**
   * Assess text extraction quality
   */
  private assessTextQuality(text: string): 'high' | 'medium' | 'low' {
    if (!text || text.length < 100) return 'low';
    
    // Check for indicators of good extraction
    const wordCount = text.split(/\s+/).length;
    const hasStructure = /\n\s*\n|\t|•|1\.|2\.|3\./.test(text);
    const nonAlphabetic = text.replace(/[a-zA-Z\s]/g, '').length;
    const alphabeticRatio = (text.length - nonAlphabetic) / text.length;

    if (wordCount > 500 && hasStructure && alphabeticRatio > 0.7) {
      return 'high';
    } else if (wordCount > 100 && alphabeticRatio > 0.5) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Calculate extraction confidence based on text and file type
   */
  private calculateExtractionConfidence(text: string, fileType: string): number {
    let baseConfidence = 0.5;

    // File type specific confidence
    if (fileType.toLowerCase().includes('pdf')) {
      baseConfidence = 0.7;
    } else if (fileType.toLowerCase().includes('docx')) {
      baseConfidence = 0.9;
    } else if (fileType.toLowerCase().includes('txt')) {
      baseConfidence = 0.95;
    }

    // Adjust based on text quality
    const quality = this.assessTextQuality(text);
    if (quality === 'high') {
      baseConfidence *= 1.2;
    } else if (quality === 'low') {
      baseConfidence *= 0.6;
    }

    return Math.min(baseConfidence, 1.0);
  }
}

/**
 * Requirements Extractor Specialist
 * Handles requirement parsing and categorization
 */
export class RequirementsExtractorSpecialist {
  private documentIntelligenceService = new DocumentIntelligenceService();
  private aiService = new AIService();
  private agentId = 'requirements-extractor';

  /**
   * Process requirement parsing task
   */
  async processRequirementParsing(workItem: WorkItem): Promise<SpecialistTaskResult> {
    try {
      console.log(`📋 Requirements extractor parsing document: ${workItem.inputs.documentId}`);
      
      const documentId = workItem.inputs.documentId;
      const rfpId = workItem.inputs.rfpId;
      const extractionFocus = workItem.inputs.extractionFocus || ['mandatory', 'optional', 'evaluation_criteria'];

      const document = await storage.getDocument(documentId);
      const rfp = await storage.getRFP(rfpId);
      
      if (!document || !rfp) {
        throw new Error(`Document or RFP not found: ${documentId}, ${rfpId}`);
      }

      if (!document.extractedText) {
        throw new Error(`Document text not extracted: ${documentId}`);
      }

      // Parse requirements using AI service
      const requirementResult = await this.extractRequirements(
        document.extractedText,
        rfp,
        extractionFocus
      );

      // Update document with parsed requirements
      await storage.updateDocument(documentId, {
        parsedData: {
          ...document.parsedData as any || {},
          requirementParsing: requirementResult
        }
      });

      // Store memory of requirement parsing
      await agentMemoryService.storeMemory({
        agentId: this.agentId,
        memoryType: 'semantic',
        contextKey: `requirements_${documentId}`,
        title: `Requirements Parsed: ${document.filename}`,
        content: {
          documentId,
          filename: document.filename,
          rfpId,
          requirementResult,
          extractionFocus
        },
        importance: 8,
        metadata: {
          workItemId: workItem.id,
          rfpId,
          requirementCount: requirementResult.requirements.length
        }
      });

      return {
        success: true,
        result: requirementResult,
        metadata: {
          documentId,
          filename: document.filename,
          requirementCount: requirementResult.requirements.length,
          mandatoryCount: requirementResult.mandatoryFields.length
        },
        nextActions: ['compliance_analysis']
      };

    } catch (error) {
      console.error(`❌ Requirement parsing failed:`, error);
      return {
        success: false,
        error: error.message,
        metadata: { workItemId: workItem.id }
      };
    }
  }

  /**
   * Extract requirements from document text
   */
  private async extractRequirements(
    documentText: string,
    rfp: RFP,
    extractionFocus: string[]
  ): Promise<RequirementParsingResult> {
    // Use AI service to extract structured requirements
    const aiAnalysis = await this.aiService.analyzeDocumentCompliance(documentText, rfp);
    
    // Structure the results
    const requirements = aiAnalysis.requirements || [];
    const mandatoryFields = aiAnalysis.mandatoryFields || [];
    const evaluationCriteria = aiAnalysis.evaluationCriteria || [];
    const deadlines = aiAnalysis.deadlines || [];

    // Categorize requirements
    const categories = this.categorizeRequirements(requirements);
    
    // Separate mandatory and optional fields
    const optionalFields = requirements.filter((req: any) => !req.mandatory);

    return {
      requirements,
      mandatoryFields,
      optionalFields,
      evaluationCriteria,
      deadlines,
      categories
    };
  }

  /**
   * Categorize requirements into logical groups
   */
  private categorizeRequirements(requirements: any[]): string[] {
    const categories = new Set<string>();
    
    requirements.forEach(req => {
      if (req.type) {
        categories.add(req.type);
      }
      if (req.category) {
        categories.add(req.category);
      }
    });

    return Array.from(categories);
  }
}

/**
 * Compliance Checker Specialist
 * Handles compliance analysis and risk assessment
 */
export class ComplianceCheckerSpecialist {
  private documentIntelligenceService = new DocumentIntelligenceService();
  private aiService = new AIService();
  private agentId = 'compliance-checker';

  /**
   * Process compliance analysis task
   */
  async processComplianceAnalysis(workItem: WorkItem): Promise<SpecialistTaskResult> {
    try {
      console.log(`✅ Compliance checker analyzing RFP: ${workItem.inputs.rfpId}`);
      
      const rfpId = workItem.inputs.rfpId;
      const documentIds = workItem.inputs.documentIds || [];
      const analysisScope = workItem.inputs.analysisScope || ['compliance_checklist', 'risk_flags'];

      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Get all documents for this RFP
      const documents = await storage.getDocumentsByRFP(rfpId);
      
      // Perform comprehensive compliance analysis
      const complianceResult = await this.analyzeCompliance(rfp, documents, analysisScope);

      // Update RFP with compliance analysis
      await storage.updateRFP(rfpId, {
        requirements: complianceResult.complianceItems,
        complianceItems: complianceResult.mandatoryChecklist,
        riskFlags: complianceResult.riskFlags
      });

      // Store memory of compliance analysis
      await agentMemoryService.storeMemory({
        agentId: this.agentId,
        memoryType: 'semantic',
        contextKey: `compliance_${rfpId}`,
        title: `Compliance Analysis: ${rfp.title}`,
        content: {
          rfpId,
          rfpTitle: rfp.title,
          complianceResult,
          analysisScope,
          documentCount: documents.length
        },
        importance: 9, // High importance for compliance
        metadata: {
          workItemId: workItem.id,
          rfpId,
          riskLevel: this.assessOverallRiskLevel(complianceResult.riskFlags),
          complianceScore: complianceResult.confidenceScore
        }
      });

      // Create notifications for high-risk items
      await this.createRiskNotifications(rfp, complianceResult.riskFlags);

      return {
        success: true,
        result: complianceResult,
        metadata: {
          rfpId,
          rfpTitle: rfp.title,
          complianceItemCount: complianceResult.complianceItems.length,
          riskFlagCount: complianceResult.riskFlags.length,
          confidenceScore: complianceResult.confidenceScore
        }
      };

    } catch (error) {
      console.error(`❌ Compliance analysis failed:`, error);
      return {
        success: false,
        error: error.message,
        metadata: { workItemId: workItem.id }
      };
    }
  }

  /**
   * Perform comprehensive compliance analysis
   */
  private async analyzeCompliance(
    rfp: RFP,
    documents: Document[],
    analysisScope: string[]
  ): Promise<ComplianceAnalysisResult> {
    // Combine all extracted text
    const combinedText = documents
      .filter(doc => doc.extractedText)
      .map(doc => doc.extractedText)
      .join('\n\n');

    if (!combinedText) {
      throw new Error('No extracted text available for compliance analysis');
    }

    // Use AI service for compliance analysis
    const aiCompliance = await this.aiService.analyzeDocumentCompliance(combinedText, rfp);
    
    // Structure compliance results
    const complianceItems = aiCompliance.requirements || [];
    const riskFlags = aiCompliance.riskFlags || [];
    const mandatoryChecklist = aiCompliance.mandatoryFields || [];

    // Calculate confidence score
    const confidenceScore = this.calculateComplianceConfidence(
      complianceItems,
      riskFlags,
      documents.length
    );

    // Generate recommendations
    const recommendations = this.generateComplianceRecommendations(
      complianceItems,
      riskFlags,
      mandatoryChecklist
    );

    return {
      complianceItems,
      riskFlags,
      mandatoryChecklist,
      confidenceScore,
      recommendations
    };
  }

  /**
   * Calculate compliance confidence score
   */
  private calculateComplianceConfidence(
    complianceItems: any[],
    riskFlags: any[],
    documentCount: number
  ): number {
    let baseScore = 0.7;

    // Adjust based on document coverage
    if (documentCount > 3) baseScore += 0.1;
    if (documentCount > 5) baseScore += 0.1;

    // Adjust based on risk assessment
    const highRiskCount = riskFlags.filter(flag => flag.type === 'high').length;
    const mediumRiskCount = riskFlags.filter(flag => flag.type === 'medium').length;

    baseScore -= (highRiskCount * 0.15);
    baseScore -= (mediumRiskCount * 0.05);

    // Adjust based on compliance item completeness
    const completeItems = complianceItems.filter(item => item.mandatory).length;
    if (completeItems > 5) baseScore += 0.1;

    return Math.max(Math.min(baseScore, 1.0), 0.0);
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(
    complianceItems: any[],
    riskFlags: any[],
    mandatoryChecklist: any[]
  ): string[] {
    const recommendations: string[] = [];

    // High-risk recommendations
    const highRiskFlags = riskFlags.filter(flag => flag.type === 'high');
    if (highRiskFlags.length > 0) {
      recommendations.push(
        `Address ${highRiskFlags.length} high-risk compliance issues immediately`
      );
    }

    // Mandatory field recommendations
    const incompleteFields = mandatoryChecklist.filter(field => !field.completed);
    if (incompleteFields.length > 0) {
      recommendations.push(
        `Complete ${incompleteFields.length} mandatory fields before submission`
      );
    }

    // Deadline recommendations
    const deadlineItems = complianceItems.filter(item => 
      item.type === 'deadline' || item.category === 'deadline'
    );
    if (deadlineItems.length > 0) {
      recommendations.push(
        'Review all deadline requirements and create submission timeline'
      );
    }

    // General recommendations
    if (complianceItems.length > 10) {
      recommendations.push(
        'Consider creating a detailed compliance tracking spreadsheet'
      );
    }

    return recommendations;
  }

  /**
   * Assess overall risk level
   */
  private assessOverallRiskLevel(riskFlags: any[]): 'low' | 'medium' | 'high' {
    const highRisk = riskFlags.filter(flag => flag.type === 'high').length;
    const mediumRisk = riskFlags.filter(flag => flag.type === 'medium').length;

    if (highRisk > 0) return 'high';
    if (mediumRisk > 2) return 'high';
    if (mediumRisk > 0) return 'medium';
    
    return 'low';
  }

  /**
   * Create notifications for high-risk items
   */
  private async createRiskNotifications(rfp: RFP, riskFlags: any[]): Promise<void> {
    const highRiskFlags = riskFlags.filter(flag => flag.type === 'high');
    
    for (const flag of highRiskFlags) {
      await storage.createNotification({
        type: 'compliance',
        title: 'High Risk Compliance Issue',
        message: `${flag.category}: ${flag.description}`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfp.id
      });
    }
  }
}

// Export specialist instances
export const documentProcessorSpecialist = new DocumentProcessorSpecialist();
export const requirementsExtractorSpecialist = new RequirementsExtractorSpecialist();
export const complianceCheckerSpecialist = new ComplianceCheckerSpecialist();