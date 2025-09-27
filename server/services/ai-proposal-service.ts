import type {
  CompanyCertification,
  CompanyContact,
  CompanyInsurance,
  CompanyProfile,
} from "@shared/schema"
import OpenAI from "openai"
import { z } from "zod"

// Zod schemas for AI service validation
const RFPAnalysisResultSchema = z.object({
  requirements: z.object({
    businessType: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
    insurance: z
      .object({
        types: z.array(z.string()),
        minimumCoverage: z.number().optional(),
      })
      .optional(),
    contactRoles: z.array(z.string()).optional(),
    businessSize: z.enum(["small", "large", "any"]).optional(),
    socioEconomicPreferences: z.array(z.string()).optional(),
    geographicRequirements: z.array(z.string()).optional(),
    experienceRequirements: z.array(z.string()).optional(),
  }),
  complianceItems: z.array(
    z.object({
      item: z.string(),
      category: z.string(),
      required: z.boolean(),
      description: z.string(),
    })
  ),
  riskFlags: z.array(
    z.object({
      type: z.enum(["deadline", "complexity", "requirements", "financial"]),
      severity: z.enum(["low", "medium", "high"]),
      description: z.string(),
    })
  ),
  keyDates: z.object({
    deadline: z.string().transform((str) => new Date(str)),
    prebidMeeting: z
      .string()
      .nullable()
      .transform((str) => (str ? new Date(str) : null))
      .optional(),
    questionsDeadline: z
      .string()
      .nullable()
      .transform((str) => (str ? new Date(str) : null))
      .optional(),
    sampleSubmission: z
      .string()
      .nullable()
      .transform((str) => (str ? new Date(str) : null))
      .optional(),
  }),
})

const GeneratedProposalContentSchema = z.object({
  executiveSummary: z.string(),
  companyOverview: z.string(),
  qualifications: z.string(),
  approach: z.string(),
  timeline: z.string(),
  certificationNarratives: z.array(z.string()),
  complianceMatrix: z.array(
    z.object({
      requirement: z.string(),
      response: z.string(),
      evidence: z.array(z.string()),
    })
  ),
  attachmentRecommendations: z.array(z.string()),
})

// Types for AI-powered proposal generation
export interface RFPAnalysisResult {
  requirements: {
    businessType?: string[]
    certifications?: string[]
    insurance?: {
      types: string[]
      minimumCoverage?: number
    }
    contactRoles?: string[]
    businessSize?: "small" | "large" | "any"
    socioEconomicPreferences?: string[]
    geographicRequirements?: string[]
    experienceRequirements?: string[]
  }
  complianceItems: {
    item: string
    category: string
    required: boolean
    description: string
  }[]
  riskFlags: {
    type: "deadline" | "complexity" | "requirements" | "financial"
    severity: "low" | "medium" | "high"
    description: string
  }[]
  keyDates: {
    deadline: Date
    prebidMeeting?: Date | null
    questionsDeadline?: Date | null
    sampleSubmission?: Date | null
  }
}

export interface CompanyDataMapping {
  profile: CompanyProfile
  relevantCertifications: CompanyCertification[]
  applicableInsurance: CompanyInsurance[]
  assignedContacts: {
    role: string
    contact: CompanyContact
    reason: string
  }[]
  businessClassifications: {
    naics: string[]
    nigp: string[]
    categories: string[]
  }
  socioEconomicQualifications: {
    smallBusiness: boolean
    womanOwned: boolean
    minorityOwned: boolean
    veteranOwned: boolean
    hubZone: boolean
  }
}

export interface ProposalGenerationRequest {
  rfpId: string
  rfpText: string
  companyProfileId: string
  proposalType?:
    | "standard"
    | "technical"
    | "construction"
    | "professional_services"
}

export interface GeneratedProposalContent {
  executiveSummary: string
  companyOverview: string
  qualifications: string
  approach: string
  timeline: string
  pricing?: {
    breakdown: any[]
    total: number
  }
  certificationNarratives: string[]
  complianceMatrix: {
    requirement: string
    response: string
    evidence: string[]
  }[]
  attachmentRecommendations: string[]
}

export class AIProposalService {
  private openaiClient: any

  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  /**
   * Analyze RFP document using AI to extract requirements and identify risks
   */
  async analyzeRFPDocument(rfpText: string): Promise<RFPAnalysisResult> {
    // Validate input length (limit to ~50k chars to avoid token limits)
    if (rfpText.length > 50000) {
      throw new Error(
        "RFP text too long. Please provide a summary or key sections only."
      )
    }

    const prompt = `Analyze this RFP document and extract key information for automated proposal generation:

RFP Document:
${rfpText}

Return a JSON object with the following structure:
{
  "requirements": {
    "businessType": ["construction", "technology"],
    "certifications": ["WBENC", "HUB", "DBE"],
    "insurance": {
      "types": ["general_liability", "professional"],
      "minimumCoverage": 1000000
    },
    "contactRoles": ["project_manager", "technical_lead"],
    "businessSize": "small",
    "socioEconomicPreferences": ["woman-owned", "minority-owned"],
    "geographicRequirements": ["local", "texas"],
    "experienceRequirements": ["5+ years construction"]
  },
  "complianceItems": [
    {
      "item": "Submit WBENC certification",
      "category": "certification",
      "required": true,
      "description": "Must provide current WBENC certificate"
    }
  ],
  "riskFlags": [
    {
      "type": "deadline",
      "severity": "high",
      "description": "Short submission deadline"
    }
  ],
  "keyDates": {
    "deadline": "2024-01-15T17:00:00.000Z",
    "prebidMeeting": "2024-01-05T10:00:00.000Z",
    "questionsDeadline": "2024-01-10T17:00:00.000Z"
  }
}

Focus on information relevant to iByte Enterprises LLC, a construction/technology company that is woman-owned with certifications (WBENC, HUB, DBE, MBE, WBE).`

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content:
              "You are an expert RFP analyst that extracts structured requirements from procurement documents. Return only valid JSON that matches the requested schema exactly.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_completion_tokens: 3000,
        response_format: { type: "json_object" },
      })

      const analysisText = response.choices[0]?.message?.content
      if (!analysisText) {
        throw new Error("No analysis received from OpenAI")
      }

      // Parse and validate with Zod
      const rawAnalysis = JSON.parse(analysisText)
      const validatedAnalysis = RFPAnalysisResultSchema.safeParse(rawAnalysis)

      if (!validatedAnalysis.success) {
        console.error(
          "Invalid analysis format from OpenAI:",
          validatedAnalysis.error
        )
        throw new Error("Invalid analysis format from AI service")
      }

      return validatedAnalysis.data
    } catch (error) {
      console.error("Error analyzing RFP document:", error)
      throw new Error(
        `Failed to analyze RFP: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
    }
  }

  /**
   * Map RFP requirements to company profile data using AI intelligence
   */
  async mapCompanyDataToRequirements(
    analysis: RFPAnalysisResult,
    companyProfile: CompanyProfile,
    certifications: CompanyCertification[],
    insurance: CompanyInsurance[],
    contacts: CompanyContact[]
  ): Promise<CompanyDataMapping> {
    // AI-powered certification selection
    const relevantCertifications = this.selectRelevantCertifications(
      analysis,
      certifications
    )

    // AI-powered insurance matching
    const applicableInsurance = this.matchInsuranceRequirements(
      analysis,
      insurance
    )

    // AI-powered contact assignment
    const assignedContacts = this.assignContactRoles(analysis, contacts)

    // Extract business classifications
    const businessClassifications = {
      naics: companyProfile.naicsPrimary ? [companyProfile.naicsPrimary] : [],
      nigp: companyProfile.nigpCodes
        ? companyProfile.nigpCodes.split(",").map((code) => code.trim())
        : [],
      categories: companyProfile.primaryBusinessCategory
        ? [companyProfile.primaryBusinessCategory]
        : [],
    }

    // Determine socio-economic qualifications
    const socioEconomicQualifications = {
      smallBusiness: true, // iByte is a small business
      womanOwned: relevantCertifications.some(
        (cert) =>
          cert.certificationType.includes("WBENC") ||
          cert.certificationType.includes("WBE")
      ),
      minorityOwned: relevantCertifications.some((cert) =>
        cert.certificationType.includes("MBE")
      ),
      veteranOwned: false, // Not applicable for iByte
      hubZone: relevantCertifications.some((cert) =>
        cert.certificationType.includes("HUB")
      ),
    }

    return {
      profile: companyProfile,
      relevantCertifications,
      applicableInsurance,
      assignedContacts,
      businessClassifications,
      socioEconomicQualifications,
    }
  }

  /**
   * Generate proposal content using AI and mapped company data
   */
  async generateProposalContent(
    analysis: RFPAnalysisResult,
    companyMapping: CompanyDataMapping,
    rfpText: string
  ): Promise<GeneratedProposalContent> {
    const companyInfo = this.formatCompanyInformation(companyMapping)

    const prompt = `Generate a comprehensive proposal response using this company information and return it as a JSON object:

${companyInfo}

For this RFP:
${rfpText}

Requirements Analysis:
${JSON.stringify(analysis.requirements, null, 2)}

Return a JSON object with the following structure:
{
  "executiveSummary": "2-3 paragraphs highlighting key qualifications and why iByte is the best choice",
  "companyOverview": "Detailed company overview emphasizing relevant experience and certifications",
  "qualifications": "Detailed capability statements and relevant experience",
  "approach": "High-level project methodology and implementation approach",
  "timeline": "General project phases and timeline considerations",
  "certificationNarratives": ["Narrative for each relevant certification explaining its value"],
  "complianceMatrix": [
    {
      "requirement": "Specific RFP requirement",
      "response": "How iByte meets this requirement",
      "evidence": ["Supporting documents or certifications"]
    }
  ],
  "attachmentRecommendations": ["List of documents to attach to proposal"]
}

Use iByte Enterprises LLC's actual information:
- DUNS: 118328036
- Federal Tax ID: [Available in company records - not transmitted to AI]
- WBENC Certification (woman-owned business)
- HUB, DBE, MBE, WBE certifications
- Construction and technology expertise
- Valorie Rodriguez as owner/president
- Address: 11324 Four Points Dr Bldg II Ste 100, Austin, TX 78726`

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content:
              "You are an expert proposal writer for government contracting. Generate professional, compliant proposal content that highlights company qualifications and addresses RFP requirements directly. Return only valid JSON that matches the requested schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
      })

      const contentText = response.choices[0]?.message?.content
      if (!contentText) {
        throw new Error("No content generated from OpenAI")
      }

      // Parse and validate with Zod
      const rawContent = JSON.parse(contentText)
      const validatedContent =
        GeneratedProposalContentSchema.safeParse(rawContent)

      if (!validatedContent.success) {
        console.error(
          "Invalid proposal content format from OpenAI:",
          validatedContent.error
        )
        throw new Error("Invalid proposal content format from AI service")
      }

      return validatedContent.data
    } catch (error) {
      console.error("Error generating proposal content:", error)
      throw new Error(
        `Failed to generate proposal: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
    }
  }

  // Private helper methods
  private selectRelevantCertifications(
    analysis: RFPAnalysisResult,
    certifications: CompanyCertification[]
  ): CompanyCertification[] {
    const requiredCerts = analysis.requirements.certifications || []
    const socioEconomicPrefs =
      analysis.requirements.socioEconomicPreferences || []

    return certifications.filter((cert) => {
      // Check for direct certification matches
      const directMatch = requiredCerts.some((req) =>
        cert.certificationType.toLowerCase().includes(req.toLowerCase())
      )

      // Check for socio-economic preference matches
      const socioEconomicMatch = socioEconomicPrefs.some((pref) => {
        const prefLower = pref.toLowerCase()
        return (
          (prefLower.includes("woman") &&
            cert.certificationType.includes("WBENC")) ||
          (prefLower.includes("minority") &&
            cert.certificationType.includes("MBE")) ||
          (prefLower.includes("disadvantaged") &&
            cert.certificationType.includes("DBE")) ||
          (prefLower.includes("hub") && cert.certificationType.includes("HUB"))
        )
      })

      return directMatch || socioEconomicMatch || cert.status === "active"
    })
  }

  private matchInsuranceRequirements(
    analysis: RFPAnalysisResult,
    insurance: CompanyInsurance[]
  ): CompanyInsurance[] {
    const requiredTypes = analysis.requirements.insurance?.types || []

    if (requiredTypes.length === 0) {
      return insurance.filter((ins) => ins.isActive)
    }

    return insurance.filter((ins) => {
      const typeMatch = requiredTypes.some((req) =>
        ins.insuranceType.toLowerCase().includes(req.toLowerCase())
      )
      return typeMatch && ins.isActive
    })
  }

  private assignContactRoles(
    analysis: RFPAnalysisResult,
    contacts: CompanyContact[]
  ) {
    const requiredRoles = analysis.requirements.contactRoles || []
    const assignments = []

    // Auto-assign primary contact
    const primaryContact = contacts.find((c) => c.contactType === "primary")
    if (primaryContact) {
      assignments.push({
        role: "Primary Contact",
        contact: primaryContact,
        reason: "Designated primary contact for all communications",
      })
    }

    // Auto-assign owner for certifications
    const owner = contacts.find((c) => c.contactType === "owner")
    if (owner) {
      assignments.push({
        role: "Business Owner",
        contact: owner,
        reason:
          "Company owner for woman-owned business certification verification",
      })
    }

    // Assign decision makers based on required roles
    const decisionMakers = contacts.filter(
      (c) => c.contactType === "decision_maker"
    )
    decisionMakers.forEach((dm) => {
      if (
        dm.decisionAreas &&
        Array.isArray(dm.decisionAreas) &&
        dm.decisionAreas.length > 0
      ) {
        dm.decisionAreas.forEach((area: string) => {
          assignments.push({
            role: this.mapDecisionAreaToRole(area),
            contact: dm,
            reason: `Decision maker for ${area} responsibilities`,
          })
        })
      }
    })

    return assignments
  }

  private mapDecisionAreaToRole(area: string): string {
    const roleMap: Record<string, string> = {
      financial_contracts: "Financial Officer",
      bids_proposals: "Proposal Manager",
      technical_engineering: "Technical Lead",
      operations_logistics: "Operations Manager",
      human_resources: "HR Manager",
      legal_compliance: "Compliance Officer",
      marketing_business_dev: "Business Development Manager",
      executive_strategic: "Executive Contact",
    }

    return roleMap[area] || area
  }

  private formatCompanyInformation(mapping: CompanyDataMapping): string {
    return `
COMPANY PROFILE:
Name: ${mapping.profile.companyName}
DBA: ${mapping.profile.dba || "N/A"}
Business Type: ${mapping.profile.primaryBusinessCategory || "Not specified"}
NAICS: ${mapping.businessClassifications.naics.join(", ") || "Not specified"}
NIGP Codes: ${
      mapping.businessClassifications.nigp.join(", ") || "Not specified"
    }
Website: ${mapping.profile.website || "Not provided"}

CERTIFICATIONS:
${mapping.relevantCertifications
  .map(
    (cert) =>
      `- ${cert.certificationType}: ${cert.certificationNumber} (Expires: ${cert.expirationDate})`
  )
  .join("\n")}

SOCIO-ECONOMIC QUALIFICATIONS:
- Small Business: ${
      mapping.socioEconomicQualifications.smallBusiness ? "Yes" : "No"
    }
- Woman-Owned: ${mapping.socioEconomicQualifications.womanOwned ? "Yes" : "No"}
- Minority-Owned: ${
      mapping.socioEconomicQualifications.minorityOwned ? "Yes" : "No"
    }
- HUBZone: ${mapping.socioEconomicQualifications.hubZone ? "Yes" : "No"}

ASSIGNED CONTACTS:
${mapping.assignedContacts
  .map(
    (assignment) =>
      `- ${assignment.role}: ${assignment.contact.name} (${assignment.contact.email})`
  )
  .join("\n")}

INSURANCE COVERAGE:
${mapping.applicableInsurance
  .map(
    (ins) => `- ${ins.insuranceType}: $${ins.coverageAmount} (${ins.carrier})`
  )
  .join("\n")}
    `
  }

  // Removed parseGeneratedContent method - content is now directly validated and returned from OpenAI JSON response
}

export const aiProposalService = new AIProposalService()
