#!/usr/bin/env tsx
/**
 * Simple agent test script that doesn't require database
 * Run with: npx tsx scripts/test-agents-simple.ts
 */

import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Helper function to run with timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  return Promise.race([promise, timeoutPromise])
}

async function testMastraAgents() {
  console.log('🤖 Testing Mastra Agents...')

  const agentTests = []

  try {
    console.log('📦 Importing all agents...')

    // Tier 1: Primary Orchestrator
    const { primaryOrchestrator } = await import('../src/mastra/agents/primary-orchestrator')
    agentTests.push({ name: 'Primary Orchestrator', agent: primaryOrchestrator })

    // Tier 2: Managers
    const { proposalManager } = await import('../src/mastra/agents/proposal-manager')
    const { portalManager } = await import('../src/mastra/agents/portal-manager')
    const { researchManager } = await import('../src/mastra/agents/research-manager')
    agentTests.push({ name: 'Proposal Manager', agent: proposalManager })
    agentTests.push({ name: 'Portal Manager', agent: portalManager })
    agentTests.push({ name: 'Research Manager', agent: researchManager })

    // Tier 3: Specialists
    const { contentGenerator } = await import('../src/mastra/agents/content-generator')
    const { complianceChecker } = await import('../src/mastra/agents/compliance-checker')
    const { documentProcessor } = await import('../src/mastra/agents/document-processor')
    const { portalScanner } = await import('../src/mastra/agents/portal-scanner')
    const { portalMonitor } = await import('../src/mastra/agents/portal-monitor')
    const { marketAnalyst } = await import('../src/mastra/agents/market-analyst')
    const { historicalAnalyzer } = await import('../src/mastra/agents/historical-analyzer')
    const { rfpAnalysisAgent } = await import('../src/mastra/agents/rfp-analysis-agent')
    const { rfpDiscoveryAgent } = await import('../src/mastra/agents/rfp-discovery-agent')
    const { rfpSubmissionAgent } = await import('../src/mastra/agents/rfp-submission-agent')

    agentTests.push({ name: 'Content Generator', agent: contentGenerator })
    agentTests.push({ name: 'Compliance Checker', agent: complianceChecker })
    agentTests.push({ name: 'Document Processor', agent: documentProcessor })
    agentTests.push({ name: 'Portal Scanner', agent: portalScanner })
    agentTests.push({ name: 'Portal Monitor', agent: portalMonitor })
    agentTests.push({ name: 'Market Analyst', agent: marketAnalyst })
    agentTests.push({ name: 'Historical Analyzer', agent: historicalAnalyzer })
    agentTests.push({ name: 'RFP Analysis Agent', agent: rfpAnalysisAgent })
    agentTests.push({ name: 'RFP Discovery Agent', agent: rfpDiscoveryAgent })
    agentTests.push({ name: 'RFP Submission Agent', agent: rfpSubmissionAgent })

    console.log(`✅ All ${agentTests.length} agents imported successfully`)

    // Test a subset of key agents to verify they work
    const testAgents = [
      { name: 'Proposal Manager', agent: proposalManager, prompt: 'Generate a brief executive summary for IT infrastructure services proposal. Keep it under 100 words.' },
      { name: 'Content Generator', agent: contentGenerator, prompt: 'Generate a technical approach section for cloud migration. Keep it under 80 words.' },
      { name: 'Compliance Checker', agent: complianceChecker, prompt: 'List 3 key government IT compliance requirements. Be concise.' },
      { name: 'Document Processor', agent: documentProcessor, prompt: 'Describe how to analyze RFP documents for key requirements. Keep it brief.' },
      { name: 'Market Analyst', agent: marketAnalyst, prompt: 'Provide a brief market analysis approach for government IT contracts.' }
    ]

    let successCount = 0
    for (const testAgent of testAgents) {
      try {
        console.log(`🧪 Testing ${testAgent.name}...`)
        const result = await withTimeout(
          testAgent.agent.generate([
            {
              role: 'user',
              content: testAgent.prompt
            }
          ]),
          30000, // 30 second timeout per agent
          testAgent.name
        )

        console.log(`✅ ${testAgent.name} working`)
        console.log(`📝 Sample output (first 100 chars): ${result.text?.substring(0, 100) + '...' || 'No text returned'}`)
        successCount++
      } catch (error) {
        console.log(`❌ ${testAgent.name} failed:`, error instanceof Error ? error.message : String(error))
      }
    }

    console.log(`\n📊 Agent Test Summary: ${successCount}/${testAgents.length} agents working`)
    return successCount === testAgents.length
  } catch (error) {
    console.log('❌ Mastra agents test failed:', error instanceof Error ? error.message : String(error))
    return false
  }
}

async function testOpenAI() {
  console.log('🔌 Testing OpenAI direct connection...')

  try {
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await withTimeout(
      openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          {
            role: 'user',
            content: 'Generate a one-sentence executive summary for a proposal to provide cloud infrastructure services.'
          }
        ],
        max_completion_tokens: 50,
      }),
      15000, // 15 second timeout
      'OpenAI API call'
    )

    const responseText = response.choices[0]?.message?.content || ''
    console.log('✅ OpenAI connection successful')
    console.log('📝 Response:', responseText)
    return true
  } catch (error) {
    console.log('❌ OpenAI connection failed:', error instanceof Error ? error.message : String(error))
    return false
  }
}

async function testProposalGenerationMethods() {
  console.log('🔬 Testing proposal generation workflow simulation...')

  const mockRFP = {
    title: 'IT Infrastructure Modernization',
    agency: 'Department of Technology',
    description: 'Modernize legacy IT systems with cloud-native solutions',
    estimatedValue: '$2.5M'
  }

  const mockCompany = {
    name: 'iByte Enterprises LLC',
    type: 'Woman-owned small business',
    capabilities: 'Cloud consulting, cybersecurity, software development'
  }

  try {
    console.log('🤖 Simulating agent-based proposal generation...')

    const { proposalManager } = await import('../src/mastra/agents/proposal-manager')
    const { contentGenerator } = await import('../src/mastra/agents/content-generator')

    // Simulate the workflow from SubmissionMaterialsService
    console.log('📋 Step 1: Generate main proposal content...')
    const proposalTask = await withTimeout(
      proposalManager.generate([
        {
          role: "user",
          content: `Generate a comprehensive proposal for RFP: ${mockRFP.title}

        RFP Details:
        - Title: ${mockRFP.title}
        - Agency: ${mockRFP.agency}
        - Description: ${mockRFP.description}
        - Estimated Value: ${mockRFP.estimatedValue}

        Company Profile:
        - Name: ${mockCompany.name}
        - Type: ${mockCompany.type}
        - Capabilities: ${mockCompany.capabilities}

        Generate sections for:
        1. Executive Summary
        2. Technical Approach
        3. Company Qualifications
        4. Project Timeline
        5. Team Structure
        6. Risk Management

        Keep each section concise but comprehensive.`,
        },
      ]),
      45000, // 45 second timeout for main proposal
      'Proposal Manager generation'
    )

    console.log('✅ Main proposal generated')
    console.log('📏 Length:', proposalTask.text?.length || 0, 'characters')

    console.log('📋 Step 2: Generate detailed content...')
    const detailedContent = await withTimeout(
      contentGenerator.generate([
        {
          role: "user",
          content: `Create detailed technical content sections for proposal:

        Focus on:
        - Demonstrating deep understanding of requirements
        - Highlighting relevant past performance
        - Showcasing technical expertise
        - Emphasizing compliance with all requirements

        Base content on: ${(proposalTask.text || '').substring(0, 500)}`,
        },
      ]),
      45000, // 45 second timeout for detailed content
      'Content Generator generation'
    )

    console.log('✅ Detailed content generated')
    console.log('📏 Length:', detailedContent.text?.length || 0, 'characters')

    // Test section extraction (simulating the private method)
    const extractSection = (text: string, sectionName: string): string => {
      const lines = text.split("\n")
      let inSection = false
      let content = ""

      for (const line of lines) {
        if (line.toLowerCase().includes(sectionName.toLowerCase())) {
          inSection = true
          continue
        }

        if (inSection) {
          if (line.match(/^\d+\./)) {
            // Next numbered section
            break
          }
          content += line + "\n"
        }
      }

      return content.trim()
    }

    console.log('📋 Step 3: Extract sections...')
    const sections = {
      executiveSummary: extractSection(proposalTask.text || '', "Executive Summary") || "Executive summary content...",
      technicalApproach: extractSection(detailedContent.text || '', "Technical Approach") || "Technical approach content...",
      qualifications: extractSection(proposalTask.text || '', "Company Qualifications") || "Qualifications content...",
    }

    console.log('✅ Sections extracted:')
    Object.entries(sections).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value.substring(0, 50)}...`)
    })

    return true
  } catch (error) {
    console.log('❌ Proposal generation simulation failed:', error instanceof Error ? error.message : String(error))
    return false
  }
}

async function main() {
  console.log('🚀 Simple Agent & Proposal Generation Tests\n')

  const results: { name: string; passed: boolean }[] = []

  try {
    // Test OpenAI connection
    const openaiTest = await withTimeout(testOpenAI(), 20000, 'OpenAI test')
    results.push({ name: 'OpenAI Connection', passed: openaiTest })

    // Test Mastra agents
    const agentsTest = await withTimeout(testMastraAgents(), 180000, 'Mastra agents test') // 3 minutes
    results.push({ name: 'Mastra Agents', passed: agentsTest })

    // Test proposal workflow
    const workflowTest = await withTimeout(testProposalGenerationMethods(), 120000, 'Proposal workflow test') // 2 minutes
    results.push({ name: 'Proposal Generation Workflow', passed: workflowTest })
  } catch (error) {
    console.error('❌ Test suite error:', error instanceof Error ? error.message : String(error))
  }

  // Print summary
  console.log('\n📊 Test Results:')
  console.log('=' .repeat(40))

  const passed = results.filter(r => r.passed).length
  const total = results.length

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
  })

  console.log('=' .repeat(40))
  console.log(`Score: ${passed}/${total} tests passed`)

  if (passed === total) {
    console.log('🎉 All core components are working!')
    console.log('💡 The proposal generation system should work correctly.')
  } else {
    console.log('⚠️  Some components failed. Check the errors above.')
  }

  return passed === total
}

// Handle help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Simple Agent Test Script

This script tests the core proposal generation components without requiring a database connection.

Usage: npx tsx scripts/test-agents-simple.ts

What it tests:
- OpenAI API connectivity with gpt-5
- Mastra agent functionality (proposal-manager, content-generator, compliance-checker)
- Proposal generation workflow simulation
- Content extraction methods

No additional options - this is meant to be a quick validation test.
`)
  process.exit(0)
}

main()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('💥 Script crashed:', error)
    process.exit(1)
  })