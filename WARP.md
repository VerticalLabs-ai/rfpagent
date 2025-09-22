# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

RFP Agent is an AI-powered automation platform that streamlines the Request for Proposal (RFP) workflow. The system uses a **3-tier agentic architecture** to automatically discover, analyze, and manage RFPs from government portals, leveraging AI to generate compliant proposals and handle submissions.

**Key Technologies:**

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Backend: Node.js + Express + TypeScript + PostgreSQL + Drizzle ORM
- AI: OpenAI GPT + Mastra Framework for agent orchestration
- Storage: Google Cloud Storage + Neon Database (serverless PostgreSQL)
- Scraping: Puppeteer + Stagehand for portal automation

## Development Commands

### Core Development

```bash
# Install dependencies
npm install

# Development server (starts both client and server)
npm run dev

# Type checking
npm run check

# Production build
npm run build

# Production server
npm start

# Database operations
npm run db:push              # Push schema changes to database
```

### Environment Setup

Required environment variables:

```bash
DATABASE_URL=postgresql://...        # Neon Database connection
OPENAI_API_KEY=sk-...               # OpenAI API key
GOOGLE_CLOUD_PROJECT_ID=...         # GCP project for storage
AUTO_WORK_DISTRIBUTION=true         # Enable automatic work distribution
PORT=5000                           # Default port (required for deployment)
```

### Testing Single Components

```bash
# Test specific RFP parsing
curl -X POST http://localhost:5000/api/rfps/manual \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/rfp", "userNotes": "Test RFP"}'

# Test AI agent processing
curl -X POST http://localhost:5000/api/ai/process-query \
  -H "Content-Type: application/json" \
  -d '{"query": "Find technology RFPs in Austin", "conversationType": "rfp_search"}'

# Trigger portal scan
curl -X POST http://localhost:5000/api/portals/{portalId}/scan
```

## Architecture Overview

### 3-Tier Agentic System

The application uses a sophisticated agent hierarchy for task management:

1. **Orchestrator Agents** (Tier 1): High-level workflow coordination
2. **Manager Agents** (Tier 2): Specialized domain management (discovery, analysis, proposal generation)
3. **Specialist Agents** (Tier 3): Specific task execution (document parsing, compliance checking, content generation)

**Key Services:**

- `agentRegistryService`: Manages agent lifecycle, capabilities, and routing
- `workflowCoordinator`: Coordinates multi-phase RFP processing workflows
- `mastraWorkflowEngine`: Orchestrates specialized agents using Mastra framework
- `aiAgentOrchestrator`: Handles conversational AI interactions

### Core Workflow Phases

RFP processing follows a state machine with these phases:

1. **Discovery**: Portal scanning and RFP identification
2. **Analysis**: Requirements extraction and compliance checking
3. **Proposal Generation**: AI-driven content creation and pricing
4. **Submission**: Automated portal submission with form filling
5. **Monitoring**: Post-submission tracking and notifications

### Database Schema Structure

The schema (`shared/schema.ts`) includes these key entity groups:

**Core RFP Entities:**

- `rfps`: Main RFP data with requirements, compliance items, risk flags
- `proposals`: Generated proposal content with narratives and pricing
- `submissions`: Portal submission tracking with receipt data
- `documents`: Attached files with extracted text and parsed data

**Agent System Tables:**

- `agentRegistry`: Registered agents with capabilities and status
- `workItems`: Distributed tasks with assignment and progress tracking
- `agentMemory`: Persistent agent knowledge and experience
- `workflowState`: Multi-phase workflow orchestration state

**Company Profile Management:**

- `companyProfiles`: Business entity information
- `companyAddresses`: Multiple address support (physical, mailing)
- `companyCertifications`: Tracked certifications with expiration alerts
- `companyInsurance`: Insurance policies with renewal tracking

### AI Integration Patterns

**Agent Memory System:**

- Agents maintain episodic, semantic, and procedural memory
- Memory importance scoring and access tracking
- Context-aware retrieval for improved decision making

**Workflow Coordination:**

```typescript
// Typical agent coordination pattern
const workItem = await workflowCoordinator.createWorkItem({
  sessionId: nanoid(),
  taskType: "rfp_analysis",
  inputs: { rfpId, companyProfileId },
  createdByAgentId: "discovery-orchestrator",
})

// Automatic assignment to best available agent
await workflowCoordinator.assignWorkItem(workItem.id)
```

**Phase State Management:**
The system uses a robust phase state machine with transition validation, dependency checking, and automatic rollback capabilities.

## Key Development Patterns

### Service Layer Organization

Services are organized by domain responsibility:

- **Discovery Services**: Portal monitoring, scanning, RFP extraction
- **Analysis Services**: Document intelligence, compliance checking, risk assessment
- **Generation Services**: Content creation, pricing analysis, proposal assembly
- **Submission Services**: Portal automation, form filling, document upload
- **Orchestration Services**: Workflow coordination, agent management, task distribution

### Error Handling and Retry Logic

```typescript
// Services implement retry with exponential backoff
await retryBackoffDlqService.executeWithRetry(
  () => portalScraping.extractRfpData(url),
  {
    maxRetries: 3,
    baseDelay: 1000,
    backoffMultiplier: 2,
    onFailure: (error) => deadLetterQueue.enqueue(workItem, error),
  }
)
```

### Document Processing Pipeline

1. Upload to Google Cloud Storage with ACL policies
2. Extract text using mammoth (DOCX), pdf-parse (PDF), or cheerio (HTML)
3. Parse structured data using AI document intelligence
4. Store extracted content with metadata in database
5. Index for search and retrieval by agents

### Real-time Updates

The application uses server-sent events and WebSocket connections for:

- Portal scan progress updates
- Agent task status changes
- Workflow phase transitions
- Submission pipeline status

## Common Development Workflows

### Adding a New Agent Type

1. Register agent in `agentRegistryService.bootstrapDefaultAgents()`
2. Define capabilities and tier placement
3. Implement task handler in appropriate specialist service
4. Update work item routing in `workflowCoordinator.getRequiredCapabilitiesForTask()`

### Adding New RFP Processing Logic

1. Update requirements extraction in `analysisSpecialists.ts`
2. Extend compliance rules in `complianceCheckerSpecialist`
3. Add proposal generation logic in `proposalGenerationSpecialists.ts`
4. Update workflow phases in `mastraWorkflowEngine.initializePhaseStateMachine()`

### Extending Portal Support

1. Add portal configuration to database with selectors and filters
2. Implement portal-specific scraping logic in `mastraScrapingService`
3. Add authentication handling if required
4. Configure scheduling in `portal-scheduler-service`

## Testing and Debugging

### Agent System Debugging

```bash
# Check agent registry status
curl http://localhost:5000/api/agents/status

# View work item queue
curl http://localhost:5000/api/work-items?status=pending

# Monitor workflow states
curl http://localhost:5000/api/workflows/active
```

### Database Debugging

```bash
# Connect to database (requires DATABASE_URL)
npx drizzle-kit studio

# Check schema migrations
npx drizzle-kit generate
```

### AI Service Testing

The AI services require valid OpenAI API keys. Test AI functionality using the chat interface at `/ai-chat` or direct API calls to `/api/ai/process-query`.

## Important Configuration Notes

- **Auto Work Distribution**: Set `AUTO_WORK_DISTRIBUTION=true` to enable background processing
- **Agent Coordination**: Agents communicate through the work item queue system
- **Portal Authentication**: Store portal credentials securely in the portals table
- **File Storage**: Configure Google Cloud Storage with proper ACL policies
- **Database Migrations**: Use Drizzle Kit for schema changes (`npm run db:push`)

## Performance Considerations

- Agent memory system tracks access patterns for optimization
- Work item distribution uses priority-based scheduling
- Document processing implements chunked processing for large files
- Portal scanning uses rate limiting to avoid blocking
- Database uses JSONB fields for flexible schema evolution
- Frontend uses TanStack Query for efficient server state management
