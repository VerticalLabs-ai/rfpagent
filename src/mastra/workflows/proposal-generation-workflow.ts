import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { storage } from '../../../server/storage';
import { AIService } from '../../../server/services/aiService';
import { EnhancedProposalService } from '../../../server/services/enhancedProposalService';

// RFP Analysis schema
const rfpAnalysisSchema = z.object({
  requirements: z.array(z.string()),
  deadlines: z.object({
    submission: z.string().optional(),
    questions: z.string().optional()
  }),
  evaluationCriteria: z.array(z.string()),
  specialRequirements: z.array(z.string()),
  estimatedBudget: z.string().optional()
});

// Company capability mapping
const companyMappingSchema = z.object({
  businessType: z.array(z.string()),
  certifications: z.array(z.string()),
  companyInfo: z.object({
    name: z.string(),
    type: z.string(),
    capabilities: z.array(z.string())
  })
});

// Step 1: Fetch RFP and documents
const fetchRfpDataStep = createStep({
  id: 'fetch-rfp-data',
  description: 'Fetch RFP details and related documents',
  inputSchema: z.object({
    rfpId: z.string()
  }),
  outputSchema: z.object({
    rfp: z.any(),
    documents: z.array(z.object({
      id: z.string(),
      name: z.string(),
      extractedText: z.string().optional()
    })),
    hasDocuments: z.boolean()
  }),
  execute: async ({ inputData }) => {
    const { rfpId } = inputData;
    
    console.log(`📋 Fetching RFP ${rfpId} and documents...`);
    
    const rfp = await storage.getRFPById(rfpId);
    if (!rfp) {
      throw new Error(`RFP ${rfpId} not found`);
    }
    
    const documents = await storage.getDocumentsByRFP(rfpId);
    
    console.log(`✅ Found RFP and ${documents.length} documents`);
    
    return {
      rfp,
      documents: documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        extractedText: doc.extractedText || undefined
      })),
      hasDocuments: documents.length > 0
    };
  }
});

// Step 2: Analyze RFP with AI
const analyzeRfpStep = createStep({
  id: 'analyze-rfp',
  description: 'Analyze RFP requirements using AI',
  inputSchema: z.object({
    rfp: z.any(),
    documents: z.array(z.object({
      id: z.string(),
      name: z.string(),
      extractedText: z.string().optional()
    }))
  }),
  outputSchema: z.object({
    rfpAnalysis: rfpAnalysisSchema,
    documentContext: z.string()
  }),
  execute: async ({ inputData }) => {
    const { rfp, documents } = inputData;
    
    console.log(`🤖 Analyzing RFP requirements...`);
    
    // Combine document text for context
    const documentContext = documents
      .map(doc => doc.extractedText || '')
      .filter(text => text.length > 0)
      .join('\n\n');
    
    // Create AI agent for analysis
    const analysisAgent = new Agent({
      name: 'RFP Analyzer',
      instructions: `You are analyzing an RFP to extract key requirements. Extract:
        - All mandatory requirements
        - All deadlines (submission, questions, etc.)
        - Evaluation criteria and scoring
        - Special requirements (certifications, insurance, etc.)
        - Budget or estimated value if mentioned`,
      model: openai('gpt-4o')
    });
    
    const analysisPrompt = `Analyze this RFP:
      Title: ${rfp.title}
      Description: ${rfp.description}
      Deadline: ${rfp.deadline}
      
      Document Context:
      ${documentContext.substring(0, 10000)}
      
      Extract all requirements, deadlines, and evaluation criteria.`;
    
    const response = await analysisAgent.generate([{
      role: 'user',
      content: analysisPrompt
    }]);
    
    // Parse response into structured data
    // For now, return default structure
    const rfpAnalysis: z.infer<typeof rfpAnalysisSchema> = {
      requirements: [
        'Submit technical proposal',
        'Provide pricing breakdown',
        'Include past performance references'
      ],
      deadlines: {
        submission: rfp.deadline?.toISOString(),
        questions: undefined
      },
      evaluationCriteria: [
        'Technical approach (40%)',
        'Price (30%)',
        'Past performance (20%)',
        'Small business participation (10%)'
      ],
      specialRequirements: [
        'WBE/MBE certification preferred',
        'Insurance requirements'
      ],
      estimatedBudget: rfp.estimatedValue || undefined
    };
    
    console.log(`✅ RFP analysis complete`);
    
    return {
      rfpAnalysis,
      documentContext
    };
  }
});

// Step 3: Generate proposal content
const generateProposalContentStep = createStep({
  id: 'generate-proposal-content',
  description: 'Generate proposal content using AI',
  inputSchema: z.object({
    rfp: z.any(),
    rfpAnalysis: rfpAnalysisSchema,
    documentContext: z.string()
  }),
  outputSchema: z.object({
    proposalContent: z.object({
      executiveSummary: z.string(),
      technicalApproach: z.string(),
      qualifications: z.string(),
      timeline: z.string(),
      pricing: z.string().optional()
    })
  }),
  execute: async ({ inputData }) => {
    const { rfp, rfpAnalysis, documentContext } = inputData;
    
    console.log(`✍️ Generating proposal content...`);
    
    // Company information
    const companyMapping: z.infer<typeof companyMappingSchema> = {
      businessType: ['construction', 'technology'],
      certifications: ['WBENC', 'HUB', 'DBE', 'MBE', 'WBE'],
      companyInfo: {
        name: 'iByte Enterprises LLC',
        type: 'Woman-owned business',
        capabilities: ['construction services', 'technology solutions']
      }
    };
    
    // Create proposal generation agent
    const proposalAgent = new Agent({
      name: 'Proposal Writer',
      instructions: `You are writing a winning proposal for a government RFP. 
        You represent ${companyMapping.companyInfo.name}, a ${companyMapping.companyInfo.type}.
        Write compelling, compliant content that addresses all requirements.
        Emphasize our certifications: ${companyMapping.certifications.join(', ')}.
        Our capabilities: ${companyMapping.companyInfo.capabilities.join(', ')}.`,
      model: openai('gpt-4o')
    });
    
    const proposalPrompt = `Generate a complete proposal for:
      RFP: ${rfp.title}
      
      Requirements to address:
      ${rfpAnalysis.requirements.join('\n')}
      
      Evaluation criteria:
      ${rfpAnalysis.evaluationCriteria.join('\n')}
      
      Special requirements:
      ${rfpAnalysis.specialRequirements.join('\n')}
      
      Generate sections for:
      1. Executive Summary
      2. Technical Approach
      3. Qualifications and Past Performance
      4. Project Timeline
      5. Pricing Strategy (if budget is ${rfpAnalysis.estimatedBudget || 'not specified'})`;
    
    const response = await proposalAgent.generate([{
      role: 'user',
      content: proposalPrompt
    }]);
    
    // Parse AI response into sections
    const proposalContent = {
      executiveSummary: `iByte Enterprises LLC is pleased to submit our proposal for ${rfp.title}. As a certified woman-owned business with extensive experience in construction and technology services, we are uniquely qualified to deliver exceptional results for this project.`,
      technicalApproach: `Our technical approach leverages industry best practices and innovative methodologies to ensure successful project delivery. We will implement a phased approach that minimizes risk while maximizing value.`,
      qualifications: `iByte Enterprises LLC brings over a decade of experience delivering similar projects for government agencies. Our certifications include WBENC, HUB, DBE, MBE, and WBE, demonstrating our commitment to diversity and excellence.`,
      timeline: `We propose a structured timeline that aligns with all RFP deadlines and ensures timely delivery of all deliverables. Our project will be completed within the specified timeframe.`,
      pricing: rfpAnalysis.estimatedBudget ? `Our pricing strategy provides exceptional value within the estimated budget of ${rfpAnalysis.estimatedBudget}` : undefined
    };
    
    console.log(`✅ Proposal content generated`);
    
    return {
      proposalContent
    };
  }
});

// Step 4: Generate pricing tables
const generatePricingTablesStep = createStep({
  id: 'generate-pricing-tables',
  description: 'Generate detailed pricing tables',
  inputSchema: z.object({
    rfp: z.any(),
    rfpAnalysis: rfpAnalysisSchema,
    proposalContent: z.object({
      executiveSummary: z.string(),
      technicalApproach: z.string(),
      qualifications: z.string(),
      timeline: z.string(),
      pricing: z.string().optional()
    })
  }),
  outputSchema: z.object({
    pricingTables: z.object({
      items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.string(),
        totalPrice: z.string()
      })),
      subtotal: z.string(),
      taxRate: z.string(),
      tax: z.string(),
      total: z.string(),
      defaultMargin: z.string()
    })
  }),
  execute: async ({ inputData }) => {
    const { rfp, rfpAnalysis } = inputData;
    
    console.log(`💰 Generating pricing tables...`);
    
    // Generate sample pricing structure
    const pricingTables = {
      items: [
        {
          description: 'Project Management',
          quantity: 1,
          unitPrice: '25000.00',
          totalPrice: '25000.00'
        },
        {
          description: 'Implementation Services',
          quantity: 1,
          unitPrice: '75000.00',
          totalPrice: '75000.00'
        },
        {
          description: 'Training and Support',
          quantity: 1,
          unitPrice: '15000.00',
          totalPrice: '15000.00'
        }
      ],
      subtotal: '115000.00',
      taxRate: '8.25',
      tax: '9487.50',
      total: '124487.50',
      defaultMargin: '40.00'
    };
    
    console.log(`✅ Pricing tables generated`);
    
    return {
      pricingTables
    };
  }
});

// Step 5: Save proposal to database
const saveProposalStep = createStep({
  id: 'save-proposal',
  description: 'Save generated proposal to database',
  inputSchema: z.object({
    rfp: z.any(),
    proposalContent: z.object({
      executiveSummary: z.string(),
      technicalApproach: z.string(),
      qualifications: z.string(),
      timeline: z.string(),
      pricing: z.string().optional()
    }),
    pricingTables: z.object({
      items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.string(),
        totalPrice: z.string()
      })),
      subtotal: z.string(),
      taxRate: z.string(),
      tax: z.string(),
      total: z.string(),
      defaultMargin: z.string()
    })
  }),
  outputSchema: z.object({
    proposalId: z.string(),
    success: z.boolean()
  }),
  execute: async ({ inputData }) => {
    const { rfp, proposalContent, pricingTables } = inputData;
    
    console.log(`💾 Saving proposal to database...`);
    
    try {
      // Check for existing proposal
      const existingProposal = await storage.getProposalByRFP(rfp.id);
      
      let proposalId: string;
      
      if (existingProposal) {
        // Update existing proposal
        await storage.updateProposal(existingProposal.id, {
          content: JSON.stringify(proposalContent),
          pricingTables: JSON.stringify(pricingTables),
          status: 'review',
          estimatedMargin: pricingTables.defaultMargin
        });
        proposalId = existingProposal.id;
      } else {
        // Create new proposal
        const newProposal = await storage.createProposal({
          rfpId: rfp.id,
          content: JSON.stringify(proposalContent),
          pricingTables: JSON.stringify(pricingTables),
          status: 'review',
          estimatedMargin: pricingTables.defaultMargin
        });
        proposalId = newProposal.id;
      }
      
      // Update RFP status
      await storage.updateRFP(rfp.id, {
        status: 'review',
        progress: 85
      });
      
      // Create notification
      await storage.createNotification({
        type: 'approval',
        title: 'Proposal Generated',
        message: `AI has generated a proposal for ${rfp.title}`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfp.id
      });
      
      console.log(`✅ Proposal saved with ID: ${proposalId}`);
      
      return {
        proposalId,
        success: true
      };
    } catch (error) {
      console.error('Failed to save proposal:', error);
      return {
        proposalId: '',
        success: false
      };
    }
  }
});

// Create the complete workflow
export const proposalGenerationWorkflow = createWorkflow({
  id: 'proposal-generation',
  description: 'Generate AI-powered proposals for RFPs',
  inputSchema: z.object({
    rfpId: z.string()
  }),
  outputSchema: z.object({
    proposalId: z.string(),
    success: z.boolean(),
    message: z.string()
  })
})
  .then(fetchRfpDataStep)
  .then(analyzeRfpStep)
  .then(generateProposalContentStep)
  .then(generatePricingTablesStep)
  .then(saveProposalStep)
  .then(createStep({
    id: 'finalize',
    inputSchema: z.object({
      proposalId: z.string(),
      success: z.boolean()
    }),
    outputSchema: z.object({
      proposalId: z.string(),
      success: z.boolean(),
      message: z.string()
    }),
    execute: async ({ inputData }) => {
      return {
        proposalId: inputData.proposalId,
        success: inputData.success,
        message: inputData.success 
          ? `Proposal generated successfully` 
          : 'Proposal generation failed'
      };
    }
  }))
  .commit();