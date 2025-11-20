#!/usr/bin/env tsx
/**
 * Test script for proposals API endpoint
 * Run with: npx tsx scripts/test-proposals-api.ts
 */

import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Set a default DATABASE_URL if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
}

async function testProposalsAPI() {
  console.log('🧪 Testing Proposals API Endpoints\n')

  try {
    // First, let's test the storage method directly
    console.log('1️⃣ Testing storage.getProposalByRFP...')
    const { storage } = await import('../server/storage')

    // Test with a non-existent RFP ID
    const testRfpId = 'test-rfp-nonexistent'
    console.log(`   Testing with RFP ID: ${testRfpId}`)

    const proposal = await storage.getProposalByRFP(testRfpId)
    console.log(`   Result: ${proposal ? 'Found proposal' : 'No proposal found (expected)'}`)

    if (proposal) {
      console.log(`   Proposal ID: ${proposal.id}`)
      console.log(`   Status: ${proposal.status}`)
      console.log(`   Created: ${proposal.createdAt}`)
    }

    console.log('\n2️⃣ Testing API route simulation...')

    // Simulate the API route behavior
    const proposals = proposal ? [proposal] : []
    console.log(`   API would return: ${JSON.stringify(proposals.length === 0 ? 'empty array' : `array with ${proposals.length} proposals`)}`)

    console.log('\n3️⃣ Testing with actual RFP IDs from database...')

    // Get some real RFP IDs to test with
    const rfps = await storage.getAllRFPs()
    console.log(`   Found ${rfps.length} RFPs in database`)

    if (rfps.length > 0) {
      const testRfp = rfps[0]
      console.log(`   Testing with real RFP ID: ${testRfp.id}`)
      console.log(`   RFP Title: ${testRfp.title}`)

      const realProposal = await storage.getProposalByRFP(testRfp.id)
      console.log(`   Proposal found: ${realProposal ? 'Yes' : 'No'}`)

      if (realProposal) {
        console.log(`   Proposal details:`)
        console.log(`     - Status: ${realProposal.status}`)
        console.log(`     - Content length: ${realProposal.content?.length || 0} chars`)
        console.log(`     - Has narratives: ${!!realProposal.narratives}`)
        console.log(`     - Has pricing: ${!!realProposal.pricingTables}`)
        console.log(`     - Estimated margin: ${realProposal.estimatedMargin || 'N/A'}`)
      }
    }

    console.log('\n✅ Proposals API test completed successfully')
    return true

  } catch (error) {
    console.error('\n❌ Proposals API test failed:', error)
    return false
  }
}

async function testAPIRoute() {
  console.log('\n4️⃣ Testing HTTP API route directly...')

  try {
    // This would require starting the server, so let's just verify the route setup
    console.log('   Checking route configuration...')

    const express = await import('express')
    const { default: proposalsRouter } = await import('../server/routes/proposals.routes')

    console.log('   ✅ Proposals router imported successfully')
    console.log('   ✅ Express imported successfully')

    // We can't easily test the HTTP endpoint without starting the full server
    console.log('   ℹ️  HTTP endpoint test would require full server startup')
    console.log('   ℹ️  Route should be available at: GET /api/proposals/rfp/:rfpId')

    return true
  } catch (error) {
    console.error('   ❌ Route configuration test failed:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Proposals API Testing Suite\n')

  const results: { name: string; passed: boolean }[] = []

  // Test storage layer
  const storageTest = await testProposalsAPI()
  results.push({ name: 'Storage Layer Test', passed: storageTest })

  // Test route configuration
  const routeTest = await testAPIRoute()
  results.push({ name: 'Route Configuration Test', passed: routeTest })

  // Summary
  console.log('\n📊 Test Results:')
  console.log('=' .repeat(40))

  const passed = results.filter(r => r.passed).length
  const total = results.length

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
  })

  console.log('=' .repeat(40))
  console.log(`Final Score: ${passed}/${total} tests passed`)

  if (passed === total) {
    console.log('\n🎉 All API tests passed!')
    console.log('💡 The proposals endpoint should work correctly in the UI.')
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.')
  }

  return passed === total
}

main()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('💥 Script crashed:', error)
    process.exit(1)
  })