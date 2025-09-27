import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import OpenAI from "openai"
import { progressTracker } from "../server/services/progressTracker"
import { SubmissionMaterialsService } from "../server/services/submissionMaterialsService"
import { storage } from "../server/storage"
import { complianceChecker } from "../src/mastra/agents/compliance-checker"
import { contentGenerator } from "../src/mastra/agents/content-generator"
import { proposalManager } from "../src/mastra/agents/proposal-manager"

// Mock dependencies
jest.mock("../server/services/progressTracker", () => ({
  progressTracker: {
    startTracking: jest.fn(),
    updateStep: jest.fn(),
  },
}))

jest.mock("../server/storage", () => ({
  storage: {
    getRFP: jest.fn(),
    getDocumentsByRFP: jest.fn(),
    getCompanyProfile: jest.fn(),
    getAllCompanyProfiles: jest.fn(),
    getProposalByRFP: jest.fn(),
    createProposal: jest.fn(),
    updateProposal: jest.fn(),
    updateRFP: jest.fn(),
  },
}))

jest.mock("../src/mastra/agents/proposal-manager", () => ({
  proposalManager: {
    generateVNext: jest.fn(),
  },
}))

jest.mock("../src/mastra/agents/content-generator", () => ({
  contentGenerator: {
    generateVNext: jest.fn(),
  },
}))

jest.mock("../src/mastra/agents/compliance-checker", () => ({
  complianceChecker: {
    generateVNext: jest.fn(),
  },
}))

jest.mock("openai")

describe("SubmissionMaterialsService", () => {
  let service: SubmissionMaterialsService
  let mockOpenAI: jest.Mocked<OpenAI>

  const mockRFP = {
    id: "rfp-123",
    title: "Test RFP for IT Services",
    agency: "Department of Test",
    description: "Comprehensive IT services for government agency",
    deadline: "2024-12-31",
    estimatedValue: "$1,000,000",
  }

  const mockCompanyProfile = {
    id: "company-123",
    businessName: "iByte Enterprises LLC",
    businessType: "Woman-owned small business",
    businessDescription:
      "Technology consulting and software development services",
    certifications: ["8(a)", "WOSB"],
    insurance: ["General Liability", "Professional Liability"],
  }

  const mockDocuments = [
    {
      id: "doc-1",
      rfpId: "rfp-123",
      extractedText:
        "This document contains technical requirements for the project including security compliance, performance metrics, and delivery timelines.",
    },
  ]

  beforeEach(() => {
    service = new SubmissionMaterialsService()
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>

    // Reset all mocks
    jest.clearAllMocks()

    // Setup default mock returns
    ;(storage.getRFP as jest.Mock).mockResolvedValue(mockRFP)
    ;(storage.getDocumentsByRFP as jest.Mock).mockResolvedValue(mockDocuments)
    ;(storage.getCompanyProfile as jest.Mock).mockResolvedValue(
      mockCompanyProfile
    )
    ;(storage.getAllCompanyProfiles as jest.Mock).mockResolvedValue([
      mockCompanyProfile,
    ])
    ;(storage.getProposalByRFP as jest.Mock).mockResolvedValue(null)
    ;(storage.createProposal as jest.Mock).mockResolvedValue({
      id: "proposal-123",
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe("generateSubmissionMaterials", () => {
    it("should successfully generate submission materials using Mastra agents", async () => {
      // Mock successful Mastra agent responses
      const mockProposalResponse = {
        text: `
        Executive Summary
        This is a comprehensive proposal for the IT services RFP.

        Technical Approach
        Our technical approach leverages industry best practices.

        Company Qualifications
        iByte Enterprises LLC brings extensive experience.

        Project Timeline
        Phase 1: Planning (Weeks 1-2)
        Phase 2: Implementation (Weeks 3-8)

        Risk Management
        We have identified key risks and mitigation strategies.
        `,
      }

      const mockDetailedResponse = {
        text: `
        Technical Approach
        Detailed technical implementation using modern frameworks.

        Team Structure
        Project Manager, Lead Developer, QA Engineer.
        `,
      }

      ;(proposalManager.generateVNext as jest.Mock).mockResolvedValue(
        mockProposalResponse
      )
      ;(contentGenerator.generateVNext as jest.Mock).mockResolvedValue(
        mockDetailedResponse
      )
      ;(complianceChecker.generateVNext as jest.Mock).mockResolvedValue({
        success: true,
      })

      const request = {
        rfpId: "rfp-123",
        companyProfileId: "company-123",
        generateCompliance: true,
        generatePricing: true,
      }

      const result = await service.generateSubmissionMaterials(request)

      expect(result.success).toBe(true)
      expect(result.materials).toBeDefined()
      expect(result.materials?.proposalId).toBe("proposal-123")
      expect(result.materials?.documents).toHaveLength(4) // Technical proposal, pricing, compliance, executive summary

      // Verify progress tracking calls
      expect(progressTracker.startTracking).toHaveBeenCalled()
      expect(progressTracker.updateStep).toHaveBeenCalledWith(
        expect.any(String),
        "initialization",
        "completed",
        "Initialization complete"
      )

      // Verify agent calls
      expect(proposalManager.generateVNext).toHaveBeenCalled()
      expect(contentGenerator.generateVNext).toHaveBeenCalled()
      expect(complianceChecker.generateVNext).toHaveBeenCalled()
    })

    it("should fall back to OpenAI when Mastra agents fail", async () => {
      // Mock Mastra agents to fail
      ;(proposalManager.generateVNext as jest.Mock).mockRejectedValue(
        new Error("Agent failed")
      )

      // Mock successful OpenAI response
      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: `
            Executive Summary
            This is a fallback proposal generated by OpenAI.

            Technical Approach
            Our approach uses proven methodologies.

            Company Qualifications
            Strong track record in IT services.

            Project Timeline
            12-week implementation plan.

            Team Structure
            Experienced team of professionals.

            Risk Management
            Comprehensive risk mitigation plan.
            `,
            },
          },
        ],
      }

      // Mock the OpenAI instance
      const mockCreate = jest.fn().mockResolvedValue(mockOpenAIResponse)
      jest.spyOn(service as any, "openai", "get").mockReturnValue({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      })

      const request = {
        rfpId: "rfp-123",
        companyProfileId: "company-123",
        generateCompliance: false,
        generatePricing: false,
      }

      const result = await service.generateSubmissionMaterials(request)

      expect(result.success).toBe(true)
      expect(result.materials).toBeDefined()
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-5",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("expert proposal writer"),
          }),
        ]),
        max_completion_tokens: 4000,
        temperature: 0.7,
      })
    })

    it("should handle missing RFP gracefully", async () => {
      ;(storage.getRFP as jest.Mock).mockResolvedValue(null)

      const request = {
        rfpId: "nonexistent-rfp",
        companyProfileId: "company-123",
      }

      const result = await service.generateSubmissionMaterials(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain("RFP nonexistent-rfp not found")
    })

    it("should handle missing company profile gracefully", async () => {
      ;(storage.getCompanyProfile as jest.Mock).mockResolvedValue(null)
      ;(storage.getAllCompanyProfiles as jest.Mock).mockResolvedValue([])

      const request = {
        rfpId: "rfp-123",
        companyProfileId: "nonexistent-company",
      }

      const result = await service.generateSubmissionMaterials(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain("No company profiles available")
    })

    it("should generate pricing tables correctly", async () => {
      // Mock successful responses
      ;(proposalManager.generateVNext as jest.Mock).mockResolvedValue({
        text: "Mock proposal",
      })
      ;(contentGenerator.generateVNext as jest.Mock).mockResolvedValue({
        text: "Mock content",
      })

      // Mock pricing analysis
      const mockPricingResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [
                  {
                    description: "Project Management",
                    quantity: 100,
                    unitPrice: 125,
                    total: 12500,
                  },
                  {
                    description: "Development Services",
                    quantity: 200,
                    unitPrice: 100,
                    total: 20000,
                  },
                ],
              }),
            },
          },
        ],
      }

      const mockCreate = jest.fn().mockResolvedValue(mockPricingResponse)
      jest.spyOn(service as any, "openai", "get").mockReturnValue({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      })

      const request = {
        rfpId: "rfp-123",
        companyProfileId: "company-123",
        generatePricing: true,
        pricingData: {
          items: [
            {
              name: "PM Services",
              category: "Labor",
              unitPrice: 125,
              unit: "hour",
              margin: 40,
            },
          ],
          defaultMargin: 40,
          laborRate: 100,
        },
      }

      const result = await service.generateSubmissionMaterials(request)

      expect(result.success).toBe(true)
      expect(result.materials?.pricing).toBeDefined()
      expect(result.materials?.pricing.lineItems).toHaveLength(2)
      expect(result.materials?.pricing.summary.total).toBeGreaterThan(0)
    })

    it("should handle compliance checking", async () => {
      // Mock successful responses
      ;(proposalManager.generateVNext as jest.Mock).mockResolvedValue({
        text: "Mock proposal",
      })
      ;(contentGenerator.generateVNext as jest.Mock).mockResolvedValue({
        text: "Mock content",
      })
      ;(complianceChecker.generateVNext as jest.Mock).mockResolvedValue({
        success: true,
      })

      const request = {
        rfpId: "rfp-123",
        companyProfileId: "company-123",
        generateCompliance: true,
      }

      const result = await service.generateSubmissionMaterials(request)

      expect(result.success).toBe(true)
      expect(result.materials?.compliance).toBeDefined()
      expect(result.materials?.compliance.checklist).toBeDefined()
      expect(result.materials?.compliance.riskAssessment).toBeDefined()
      expect(complianceChecker.generateVNext).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("compliance analysis"),
          }),
        ])
      )
    })

    it("should update existing proposals instead of creating new ones", async () => {
      const existingProposal = { id: "existing-proposal-123" }
      ;(storage.getProposalByRFP as jest.Mock).mockResolvedValue(
        existingProposal
      )
      ;(proposalManager.generateVNext as jest.Mock).mockResolvedValue({
        text: "Mock proposal",
      })
      ;(contentGenerator.generateVNext as jest.Mock).mockResolvedValue({
        text: "Mock content",
      })

      const request = {
        rfpId: "rfp-123",
        companyProfileId: "company-123",
      }

      const result = await service.generateSubmissionMaterials(request)

      expect(result.success).toBe(true)
      expect(storage.updateProposal).toHaveBeenCalledWith(
        "existing-proposal-123",
        expect.objectContaining({
          status: "review",
          content: expect.any(String),
        })
      )
      expect(storage.createProposal).not.toHaveBeenCalled()
    })
  })

  describe("extractSection", () => {
    it("should extract sections correctly", () => {
      const text = `
      1. Executive Summary
      This is the executive summary content.
      It spans multiple lines.

      2. Technical Approach
      This is the technical approach content.

      3. Next Section
      This is another section.
      `

      const extractSection = (service as any).extractSection.bind(service)
      const result = extractSection(text, "Executive Summary")

      expect(result).toContain("This is the executive summary content")
      expect(result).toContain("It spans multiple lines")
      expect(result).not.toContain("Technical Approach")
    })
  })

  describe("formatTechnicalProposal", () => {
    it("should format technical proposal correctly", () => {
      const content = {
        executiveSummary: "Executive summary content",
        technicalApproach: "Technical approach content",
        qualifications: "Qualifications content",
        timeline: "Timeline content",
        teamStructure: "Team structure content",
        riskManagement: "Risk management content",
      }

      const formatTechnicalProposal = (
        service as any
      ).formatTechnicalProposal.bind(service)
      const result = formatTechnicalProposal(content)

      expect(result).toContain("TECHNICAL PROPOSAL")
      expect(result).toContain("EXECUTIVE SUMMARY")
      expect(result).toContain("Executive summary content")
      expect(result).toContain("TECHNICAL APPROACH")
      expect(result).toContain("Technical approach content")
    })
  })

  describe("formatPricingSchedule", () => {
    it("should format pricing schedule correctly", () => {
      const pricingData = {
        lineItems: [
          {
            description: "Project Management",
            quantity: 100,
            unitPrice: 125,
            total: 12500,
          },
          {
            description: "Development",
            quantity: 200,
            unitPrice: 100,
            total: 20000,
          },
        ],
        summary: {
          subtotal: 32500,
          tax: 2681.25,
          total: 35181.25,
          margin: 40,
        },
      }

      const formatPricingSchedule = (service as any).formatPricingSchedule.bind(
        service
      )
      const result = formatPricingSchedule(pricingData)

      expect(result).toContain("PRICING SCHEDULE")
      expect(result).toContain("Project Management")
      expect(result).toContain("Quantity: 100")
      expect(result).toContain("Unit Price: $125.00")
      expect(result).toContain("Total: $35181.25")
    })

    it("should handle missing pricing data", () => {
      const formatPricingSchedule = (service as any).formatPricingSchedule.bind(
        service
      )
      const result = formatPricingSchedule(null)

      expect(result).toBe("Pricing schedule not generated")
    })
  })
})
