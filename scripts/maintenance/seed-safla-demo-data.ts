/**
 * Seed SAFLA Demo Data
 *
 * Populates the database with sample learning events, performance metrics,
 * and knowledge base entries to demonstrate the SAFLA system capabilities.
 *
 * Usage:
 *   tsx scripts/seed-safla-demo-data.ts
 */

import { db } from '../server/db';
import {
  agentPerformanceMetrics,
  agentMemory,
  agentKnowledgeBase,
  proposals,
  scans,
  documents,
  portals,
  rfps,
} from '../shared/schema';
import { randomUUID } from 'crypto';

async function seedDemoData() {
  console.log('🌱 Seeding SAFLA demo data...\n');

  try {
    // 1. Create sample portals
    console.log('📍 Creating sample portals...');
    const portalData = await db.insert(portals).values([
      {
        name: 'Philadelphia Procurement Portal',
        url: 'https://www.phila.gov/departments/office-of-procurement/',
        loginRequired: false,
        scanFrequency: 'daily',
      },
      {
        name: 'California eProcurement',
        url: 'https://caleprocure.ca.gov',
        loginRequired: true,
        scanFrequency: 'weekly',
      },
    ]).returning();
    console.log(`✅ Created ${portalData.length} portals\n`);

    // 2. Create sample RFPs
    console.log('📄 Creating sample RFPs...');
    const rfpData = await db.insert(rfps).values([
      {
        title: 'IT Services Contract 2025',
        agency: 'City of Philadelphia',
        sourceUrl: 'https://www.phila.gov/departments/office-of-procurement/rfp-123',
        description: 'Request for proposal for IT consulting and development services',
        status: 'active',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      {
        title: 'Cloud Infrastructure Modernization',
        agency: 'California Department of Technology',
        sourceUrl: 'https://caleprocure.ca.gov/rfp-456',
        description: 'Modernize state cloud infrastructure and migration services',
        status: 'active',
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
      },
    ]).returning();
    console.log(`✅ Created ${rfpData.length} RFPs\n`);

    // 3. Create sample scans (portal navigation data)
    console.log('🔍 Creating sample portal scans...');
    const scanData = [];
    for (let i = 0; i < 10; i++) {
      const portal = portalData[i % 2];
      const status = i < 8 ? 'completed' : 'failed';
      const startedAt = new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000);
      const completedAt = status === 'completed'
        ? new Date(startedAt.getTime() + Math.random() * 60000)
        : undefined;

      scanData.push({
        portalId: portal.id,
        status,
        startedAt,
        completedAt,
        rfpsFound: status === 'completed' ? Math.floor(Math.random() * 5) + 1 : 0,
        results: {
          success: status === 'completed',
          rfpsFound: status === 'completed' ? Math.floor(Math.random() * 5) + 1 : 0,
        },
      });
    }
    await db.insert(scans).values(scanData);
    console.log(`✅ Created ${scanData.length} portal scans\n`);

    // 4. Create sample proposals
    console.log('💼 Creating sample proposals...');
    const proposalData = [];
    for (const rfp of rfpData) {
      proposalData.push({
        rfpId: rfp.id,
        status: Math.random() > 0.5 ? 'approved' : 'draft' as const,
        content: {
          executiveSummary: `Proposal for ${rfp.title}`,
          technicalApproach: 'Our comprehensive approach...',
          pricing: { total: Math.floor(Math.random() * 100000) + 50000 },
        },
        generatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      });
    }
    await db.insert(proposals).values(proposalData);
    console.log(`✅ Created ${proposalData.length} proposals\n`);

    // 5. Create sample documents
    console.log('📑 Creating sample documents...');
    const documentData = [];
    for (const rfp of rfpData) {
      documentData.push({
        rfpId: rfp.id,
        storageKey: `documents/${randomUUID()}.pdf`,
        fileName: `${rfp.title.replace(/\s+/g, '_')}.pdf`,
        fileType: 'application/pdf',
        fileSize: Math.floor(Math.random() * 5000000) + 100000,
        uploadedAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
      });
    }
    await db.insert(documents).values(documentData);
    console.log(`✅ Created ${documentData.length} documents\n`);

    // 6. Create agent performance metrics
    console.log('📊 Creating agent performance metrics...');
    const agentIds = [
      'orchestrator-primary',
      'portal-manager',
      'proposal-manager',
      'portal-scanner',
      'document-processor',
    ];

    const performanceData = [];
    for (const agentId of agentIds) {
      // Create metrics for the past 7 days
      for (let day = 0; day < 7; day++) {
        const recordedAt = new Date(Date.now() - day * 24 * 60 * 60 * 1000);

        // Task completion metrics
        performanceData.push({
          agentId,
          metricType: 'task_completion',
          metricValue: 0.8 + Math.random() * 0.15, // 80-95% success rate
          recordedAt,
          metadata: {
            tasksCompleted: Math.floor(Math.random() * 10) + 5,
            tasksFailed: Math.floor(Math.random() * 2),
          },
        });

        // Efficiency metrics
        performanceData.push({
          agentId,
          metricType: 'efficiency',
          metricValue: 0.75 + Math.random() * 0.2, // 75-95% efficiency
          recordedAt,
          metadata: {
            avgDuration: Math.floor(Math.random() * 10000) + 5000,
          },
        });
      }
    }
    await db.insert(agentPerformanceMetrics).values(performanceData);
    console.log(`✅ Created ${performanceData.length} performance metrics\n`);

    // 7. Create agent memory (learning events)
    console.log('🧠 Creating agent learning events...');
    const memoryData = [];

    // Episodic memories (learning events)
    for (let i = 0; i < 25; i++) {
      const agentId = agentIds[Math.floor(Math.random() * agentIds.length)];
      const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      memoryData.push({
        agentId,
        memoryType: 'episodic',
        content: `Learned pattern: ${['portal navigation', 'document parsing', 'proposal generation'][Math.floor(Math.random() * 3)]}`,
        context: JSON.stringify({
          action: 'task_completion',
          success: Math.random() > 0.2,
          timestamp: createdAt.toISOString(),
        }),
        importance: Math.random(),
        createdAt,
        metadata: {
          outcome: Math.random() > 0.2 ? 'success' : 'failure',
          learning: 'Strategy adapted based on outcome',
        },
      });
    }

    // Procedural memories (document parsing accuracy)
    for (let i = 0; i < 15; i++) {
      const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      memoryData.push({
        agentId: 'document-processor',
        memoryType: 'procedural',
        content: 'Document parsing procedure learned',
        context: JSON.stringify({
          context: 'document_parsing',
          documentType: 'RFP',
        }),
        importance: Math.random(),
        createdAt,
        metadata: {
          accuracy: 0.85 + Math.random() * 0.1, // 85-95% accuracy
          method: 'ai_extraction',
        },
      });
    }

    await db.insert(agentMemory).values(memoryData);
    console.log(`✅ Created ${memoryData.length} agent memories\n`);

    // 8. Create knowledge base entries
    console.log('📚 Creating knowledge base entries...');
    const knowledgeData = [];

    const knowledgeTopics = [
      { domain: 'portal_navigation', content: 'Successful selector strategy for pagination', confidence: 0.9 },
      { domain: 'portal_navigation', content: 'Timeout handling for slow-loading portals', confidence: 0.85 },
      { domain: 'document_processing', content: 'Table extraction from PDF documents', confidence: 0.92 },
      { domain: 'document_processing', content: 'Requirement identification patterns', confidence: 0.88 },
      { domain: 'proposal_generation', content: 'Winning technical approach patterns', confidence: 0.87 },
      { domain: 'proposal_generation', content: 'Competitive pricing strategies', confidence: 0.82 },
      { domain: 'compliance', content: 'Common compliance requirement patterns', confidence: 0.91 },
    ];

    for (const topic of knowledgeTopics) {
      const createdAt = new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000);

      knowledgeData.push({
        agentId: 'orchestrator-primary',
        domain: topic.domain,
        content: topic.content,
        source: 'learned_from_experience',
        confidence: topic.confidence,
        createdAt,
        metadata: {
          applications: Math.floor(Math.random() * 10) + 1,
          successRate: topic.confidence,
        },
      });
    }

    await db.insert(agentKnowledgeBase).values(knowledgeData);
    console.log(`✅ Created ${knowledgeData.length} knowledge base entries\n`);

    console.log('✅ SAFLA demo data seeding complete!\n');
    console.log('📈 Summary:');
    console.log(`   - ${portalData.length} portals`);
    console.log(`   - ${rfpData.length} RFPs`);
    console.log(`   - ${scanData.length} portal scans`);
    console.log(`   - ${proposalData.length} proposals`);
    console.log(`   - ${documentData.length} documents`);
    console.log(`   - ${performanceData.length} performance metrics`);
    console.log(`   - ${memoryData.length} learning events`);
    console.log(`   - ${knowledgeData.length} knowledge entries\n`);

    console.log('🎯 You should now see meaningful data in the SAFLA dashboard!');
    console.log('   Visit: http://localhost:3000/safla-dashboard\n');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  }
}

// Run the seed script
seedDemoData()
  .then(() => {
    console.log('✅ Seed script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed script failed:', error);
    process.exit(1);
  });
