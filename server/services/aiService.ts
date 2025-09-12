import OpenAI from "openai";
import { storage } from "../storage";
import type { RFP } from "@shared/schema";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export class AIService {
  async analyzeDocumentCompliance(documentText: string, rfpContext: any): Promise<any> {
    try {
      const prompt = `
Analyze this RFP document and extract compliance requirements, deadlines, and risk factors. 
Respond with JSON in this format:
{
  "requirements": [{"type": "string", "description": "string", "mandatory": boolean}],
  "deadlines": [{"type": "string", "date": "string", "description": "string"}],
  "riskFlags": [{"type": "high|medium|low", "category": "string", "description": "string"}],
  "evaluationCriteria": [{"criterion": "string", "weight": "string", "description": "string"}],
  "mandatoryFields": [{"field": "string", "format": "string", "description": "string"}]
}

Pay special attention to:
- Notarization requirements
- Cashier's check or bond requirements  
- Insurance certificate requirements
- Specific form formats
- Submission deadlines and methods

Document text:
${documentText}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error("Error analyzing document compliance:", error);
      throw new Error("Failed to analyze document compliance");
    }
  }

  async generateProposal(rfp: RFP): Promise<void> {
    try {
      // Get related documents for context
      const documents = await storage.getDocumentsByRFP(rfp.id);
      const documentContext = documents.map(doc => doc.extractedText).join("\n\n");

      // Generate proposal content
      const proposalContent = await this.generateProposalContent(rfp, documentContext);
      
      // Generate pricing
      const pricingTables = await this.generatePricingTables(rfp, documentContext);

      // Create or update proposal
      const existingProposal = await storage.getProposalByRFP(rfp.id);
      
      if (existingProposal) {
        await storage.updateProposal(existingProposal.id, {
          content: proposalContent,
          pricingTables,
          status: "review",
          estimatedMargin: pricingTables?.defaultMargin || "40.00"
        });
      } else {
        await storage.createProposal({
          rfpId: rfp.id,
          content: proposalContent,
          pricingTables,
          status: "review",
          estimatedMargin: pricingTables?.defaultMargin || "40.00"
        });
      }

      // Update RFP status
      await storage.updateRFP(rfp.id, { 
        status: "review", 
        progress: 85 
      });

      // Create notification
      await storage.createNotification({
        type: "approval",
        title: "Proposal Ready for Review",
        message: `AI has completed the proposal for ${rfp.title}`,
        relatedEntityType: "rfp",
        relatedEntityId: rfp.id
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: "rfp",
        entityId: rfp.id,
        action: "proposal_generated",
        details: { aiGenerated: true }
      });

    } catch (error) {
      console.error("Error generating proposal:", error);
      
      // Update RFP status to indicate error
      await storage.updateRFP(rfp.id, { 
        status: "discovered", 
        progress: 25 
      });

      // Create notification about error
      await storage.createNotification({
        type: "compliance",
        title: "Proposal Generation Failed",
        message: `Failed to generate proposal for ${rfp.title}`,
        relatedEntityType: "rfp",
        relatedEntityId: rfp.id
      });
    }
  }

  private async generateProposalContent(rfp: RFP, documentContext: string): Promise<any> {
    const prompt = `
Generate a comprehensive, professional proposal response for this RFP.
Respond with JSON in this format:
{
  "executiveSummary": "string",
  "companyOverview": "string", 
  "technicalApproach": "string",
  "projectTeam": "string",
  "timeline": "string",
  "qualifications": "string",
  "references": "string"
}

RFP Details:
Title: ${rfp.title}
Agency: ${rfp.agency}
Description: ${rfp.description}
Estimated Value: ${rfp.estimatedValue}

Requirements Context:
${documentContext}

Focus on water supply expertise, compliance with government regulations, and proven track record.
Use professional language suitable for government procurement.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4
    });

    return JSON.parse(response.choices[0].message.content);
  }

  private async generatePricingTables(rfp: RFP, documentContext: string): Promise<any> {
    const prompt = `
Generate a detailed pricing breakdown for this water supply RFP targeting 40% margin.
Respond with JSON in this format:
{
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unit": "string", 
      "unitCost": number,
      "totalCost": number
    }
  ],
  "subtotal": number,
  "margin": number,
  "totalPrice": number,
  "defaultMargin": number,
  "notes": ["string"]
}

RFP Details:
Title: ${rfp.title}
Estimated Value: ${rfp.estimatedValue}

Base your pricing on industry standards for:
- Bottled water supply (per gallon/case)
- Delivery costs
- Storage and handling
- Administrative overhead
- Insurance and bonding

Target 40% gross margin. Be competitive but profitable.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async extractRFPDetails(scrapedContent: string, sourceUrl: string): Promise<any> {
    try {
      const prompt = `
Extract structured RFP information from this scraped content.
Respond with JSON in this format:
{
  "title": "string",
  "description": "string", 
  "agency": "string",
  "deadline": "YYYY-MM-DD" or null,
  "estimatedValue": number or null,
  "category": "string",
  "requirements": ["string"],
  "contactInfo": "string"
}

Focus on water supply, beverage, or related contracts. If this is not a relevant RFP, return null.

Source URL: ${sourceUrl}
Content: ${scrapedContent}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result.title ? result : null;
    } catch (error) {
      console.error("Error extracting RFP details:", error);
      return null;
    }
  }
}
