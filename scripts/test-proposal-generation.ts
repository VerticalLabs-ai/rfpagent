#!/usr/bin/env tsx
/**
 * Integration test script for proposal generation
 * Run with: npx tsx scripts/test-proposal-generation.ts
 */

import dotenv from "dotenv"

// Load environment variables first
dotenv.config()

// Set a default DATABASE_URL if not set (for testing without real DB)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"
}

import { SubmissionMaterialsService } from "../server/services/submissionMaterialsService"

interface TestConfig {
  useRealData: boolean
  testMastraAgents: boolean
  testOpenAIFallback: boolean
  rfpId?: string
  companyProfileId?: string
}

const config: TestConfig = {
  useRealData: process.argv.includes("--real-data"),
  testMastraAgents: !process.argv.includes("--skip-agents"),
  testOpenAIFallback: process.argv.includes("--test-fallback"),
  rfpId: process.argv.find((arg) => arg.startsWith("--rfp="))?.split("=")[1],
  companyProfileId: process.argv
    .find((arg) => arg.startsWith("--company="))
    ?.split("=")[1],
}

// Mock data for testing
const mockRFP = {
  id: "test-rfp-123",
  title: "IT Infrastructure Modernization Services",
  agency: "Department of Technology",
  description:
    "The agency requires comprehensive IT infrastructure modernization including cloud migration, security upgrades, and system integration.",
  deadline: "2024-12-31T23:59:59.000Z",
  estimatedValue: "$2,500,000",
  status: "analysis" as const,
  progress: 85,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCompanyProfile = {
  id: "test-company-123",
  businessName: "iByte Enterprises LLC",
  businessType: "Woman-owned small business (WOSB)",
  businessDescription:
    "Full-service technology consulting firm specializing in government contracting, cloud infrastructure, cybersecurity, and software development services.",
  certifications: [
    "8(a) SBA Certified",
    "WOSB Certified",
    "ISO 27001",
    "SOC 2 Type II",
  ],
  insurance: [
    "General Liability: $2M",
    "Professional Liability: $1M",
    "Cyber Liability: $5M",
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockDocuments = [
  {
    id: "test-doc-1",
    rfpId: "test-rfp-123",
    name: "Technical Requirements.pdf",
    extractedText: `
    TECHNICAL REQUIREMENTS DOCUMENT

    1. SYSTEM REQUIREMENTS
    - Cloud-native architecture required
    - Must support minimum 10,000 concurrent users
    - 99.9% uptime SLA requirement
    - Multi-factor authentication mandatory

    2. SECURITY REQUIREMENTS
    - FedRAMP Moderate baseline compliance
    - NIST Cybersecurity Framework alignment
    - Regular penetration testing required
    - Zero-trust security model implementation

    3. INTEGRATION REQUIREMENTS
    - RESTful API integration with existing systems
    - Single sign-on (SSO) capability
    - Real-time data synchronization
    - Legacy system migration support

    4. PERFORMANCE REQUIREMENTS
    - Sub-2 second page load times
    - 24/7 system monitoring
    - Automated scaling capabilities
    - Disaster recovery plan with 4-hour RTO

    5. COMPLIANCE REQUIREMENTS
    - Section 508 accessibility compliance
    - Data retention policies per federal guidelines
    - Privacy Act compliance
    - Regular security audits and reporting
    `,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

async function setupMockData() {
  console.log("🔧 Setting up mock data...")

  const { storage } = await import("../server/storage")

  // Override storage methods with mock data
  const originalGetRFP = storage.getRFP
  const originalGetDocumentsByRFP = storage.getDocumentsByRFP
  const originalGetCompanyProfile = storage.getCompanyProfile
  const originalGetAllCompanyProfiles = storage.getAllCompanyProfiles
  const originalCreateProposal = storage.createProposal
  const originalGetProposalByRFP = storage.getProposalByRFP

  storage.getRFP = async (id: string) => {
    if (id === "test-rfp-123") return mockRFP
    return originalGetRFP(id)
  }

  storage.getDocumentsByRFP = async (rfpId: string) => {
    if (rfpId === "test-rfp-123") return mockDocuments
    return originalGetDocumentsByRFP(rfpId)
  }

  storage.getCompanyProfile = async (id: string) => {
    if (id === "test-company-123") return mockCompanyProfile
    return originalGetCompanyProfile(id)
  }

  storage.getAllCompanyProfiles = async () => {
    return [mockCompanyProfile]
  }

  storage.getProposalByRFP = async () => null

  storage.createProposal = async (data: any) => {
    console.log("📄 Mock proposal created with data:", {
      rfpId: data.rfpId,
      status: data.status,
      contentLength: data.content?.length || 0,
    })
    return { id: "test-proposal-123" }
  }

  return () => {
    // Restore original methods
    storage.getRFP = originalGetRFP
    storage.getDocumentsByRFP = originalGetDocumentsByRFP
    storage.getCompanyProfile = originalGetCompanyProfile
    storage.getAllCompanyProfiles = originalGetAllCompanyProfiles
    storage.createProposal = originalCreateProposal
    storage.getProposalByRFP = originalGetProposalByRFP
  }
}

async function testProposalGeneration(testName: string, request: any) {
  console.log(`\n🧪 Testing: ${testName}`)
  console.log("📋 Request:", JSON.stringify(request, null, 2))

  const service = new SubmissionMaterialsService()
  const startTime = Date.now()

  try {
    const result = await service.generateSubmissionMaterials(request)
    const duration = Date.now() - startTime

    console.log(`⏱️  Duration: ${duration}ms`)

    if (result.success) {
      console.log("✅ Test passed!")
      console.log("📊 Results summary:")
      console.log(`   - Proposal ID: ${result.materials?.proposalId}`)
      console.log(
        `   - Documents generated: ${result.materials?.documents.length}`
      )
      console.log(
        `   - Compliance items: ${result.materials?.compliance.checklist.length}`
      )
      console.log(
        `   - Pricing line items: ${result.materials?.pricing.lineItems.length}`
      )

      // Show first few lines of each document
      result.materials?.documents.forEach((doc, index) => {
        const preview =
          doc.content.substring(0, 100).replace(/\n/g, " ") + "..."
        console.log(`   - Document ${index + 1} (${doc.type}): ${preview}`)
      })

      return true
    } else {
      console.log("❌ Test failed!")
      console.log("🚫 Error:", result.error)
      return false
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.log(`⏱️  Duration: ${duration}ms`)
    console.log("💥 Test crashed!")
    console.log(
      "🚫 Error:",
      error instanceof Error ? error.message : String(error)
    )
    console.log(
      "📋 Stack:",
      error instanceof Error ? error.stack : "No stack trace"
    )
    return false
  }
}

async function testMastraAgentConnectivity() {
  console.log("\n🔌 Testing Mastra agent connectivity...")

  try {
    const { proposalManager } = await import(
      "../src/mastra/agents/proposal-manager"
    )
    const { contentGenerator } = await import(
      "../src/mastra/agents/content-generator"
    )
    const { complianceChecker } = await import(
      "../src/mastra/agents/compliance-checker"
    )

    console.log("✅ All Mastra agents imported successfully")

    // Test a simple call to proposal manager
    try {
      console.log("🤖 Testing proposal manager...")
      const testResult = await proposalManager.generate([
        {
          role: "user",
          content:
            "Generate a brief test response about proposal writing. Keep it under 50 words.",
        },
      ])

      console.log("✅ Proposal manager is working")
      console.log(
        "📝 Sample response:",
        testResult.text?.substring(0, 100) || "No text returned"
      )
      return true
    } catch (agentError) {
      console.log(
        "❌ Proposal manager failed:",
        agentError instanceof Error ? agentError.message : String(agentError)
      )
      return false
    }
  } catch (importError) {
    console.log(
      "❌ Failed to import Mastra agents:",
      importError instanceof Error ? importError.message : String(importError)
    )
    return false
  }
}

async function testOpenAIConnectivity() {
  console.log("\n🔌 Testing OpenAI connectivity...")

  try {
    const OpenAI = (await import("openai")).default
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content:
            'Say "OpenAI connection test successful" in exactly those words.',
        },
      ],
      max_completion_tokens: 20,
    })

    const responseText = response.choices[0]?.message?.content || ""
    console.log("✅ OpenAI connection successful")
    console.log("📝 Response:", responseText)
    return true
  } catch (error) {
    console.log(
      "❌ OpenAI connection failed:",
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}

async function main() {
  console.log("🚀 Starting Proposal Generation Integration Tests\n")
  console.log("Configuration:")
  console.log(`   - Use real data: ${config.useRealData}`)
  console.log(`   - Test Mastra agents: ${config.testMastraAgents}`)
  console.log(`   - Test OpenAI fallback: ${config.testOpenAIFallback}`)
  console.log(`   - RFP ID: ${config.rfpId || "test-rfp-123 (mock)"}`)
  console.log(
    `   - Company ID: ${config.companyProfileId || "test-company-123 (mock)"}`
  )

  const results: { name: string; passed: boolean }[] = []

  // Test connectivity first
  if (config.testMastraAgents) {
    const mastraTest = await testMastraAgentConnectivity()
    results.push({ name: "Mastra Agent Connectivity", passed: mastraTest })
  }

  const openaiTest = await testOpenAIConnectivity()
  results.push({ name: "OpenAI Connectivity", passed: openaiTest })

  // Setup data
  let restoreMocks: (() => void) | undefined
  if (!config.useRealData) {
    restoreMocks = await setupMockData()
  }

  try {
    // Test basic proposal generation
    const basicTest = await testProposalGeneration(
      "Basic Proposal Generation",
      {
        rfpId: config.rfpId || "test-rfp-123",
        companyProfileId: config.companyProfileId || "test-company-123",
        generateCompliance: true,
        generatePricing: true,
      }
    )
    results.push({ name: "Basic Proposal Generation", passed: basicTest })

    // Test with custom instructions
    const customTest = await testProposalGeneration(
      "Proposal with Custom Instructions",
      {
        rfpId: config.rfpId || "test-rfp-123",
        companyProfileId: config.companyProfileId || "test-company-123",
        generateCompliance: true,
        generatePricing: true,
        customInstructions:
          "Emphasize our cybersecurity expertise and government contracting experience. Highlight our woman-owned business certification.",
      }
    )
    results.push({ name: "Custom Instructions Test", passed: customTest })

    // Test with pricing data
    const pricingTest = await testProposalGeneration(
      "Proposal with Custom Pricing",
      {
        rfpId: config.rfpId || "test-rfp-123",
        companyProfileId: config.companyProfileId || "test-company-123",
        generateCompliance: false,
        generatePricing: true,
        pricingData: {
          items: [
            {
              name: "Senior Developer",
              category: "Labor",
              unitPrice: 150,
              unit: "hour",
              margin: 45,
            },
            {
              name: "Cloud Infrastructure",
              category: "Services",
              unitPrice: 5000,
              unit: "monthly",
              margin: 30,
            },
            {
              name: "Security Assessment",
              category: "Services",
              unitPrice: 25000,
              unit: "one-time",
              margin: 40,
            },
          ],
          defaultMargin: 40,
          laborRate: 125,
          overheadRate: 20,
        },
      }
    )
    results.push({ name: "Custom Pricing Test", passed: pricingTest })
  } finally {
    // Clean up
    if (restoreMocks) {
      restoreMocks()
    }
  }

  // Print summary
  console.log("\n📊 Test Results Summary:")
  console.log("=".repeat(50))

  const passed = results.filter((r) => r.passed).length
  const total = results.length

  results.forEach((result) => {
    const icon = result.passed ? "✅" : "❌"
    console.log(`${icon} ${result.name}`)
  })

  console.log("=".repeat(50))
  console.log(`Final Score: ${passed}/${total} tests passed`)

  if (passed === total) {
    console.log(
      "🎉 All tests passed! Proposal generation is working correctly."
    )
    process.exit(0)
  } else {
    console.log("⚠️  Some tests failed. Check the logs above for details.")
    process.exit(1)
  }
}

// Handle command line help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Proposal Generation Test Script

Usage: npx tsx scripts/test-proposal-generation.ts [options]

Options:
  --real-data          Use real data from database instead of mocks
  --skip-agents        Skip testing Mastra agents (test fallback only)
  --test-fallback      Force test of OpenAI fallback mechanism
  --rfp=<id>          Use specific RFP ID (requires --real-data)
  --company=<id>      Use specific company profile ID (requires --real-data)
  --help, -h          Show this help message

Examples:
  npx tsx scripts/test-proposal-generation.ts
  npx tsx scripts/test-proposal-generation.ts --real-data --rfp=abc123
  npx tsx scripts/test-proposal-generation.ts --skip-agents
  npx tsx scripts/test-proposal-generation.ts --test-fallback
`)
  process.exit(0)
}

main().catch((error) => {
  console.error("💥 Script crashed:", error)
  process.exit(1)
})
