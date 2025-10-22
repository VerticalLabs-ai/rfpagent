# Server Directory - RFP Agent Backend

**Last Updated**: January 2025

## Overview

The `server/` directory contains the Express-based backend API for the RFP Agent platform. It implements a sophisticated 3-tier AI agent system for automated RFP discovery, document processing, proposal generation, and submission management.

## Purpose

This directory serves as the complete backend application that:

- **REST API** - Provides comprehensive API endpoints for all RFP operations
- **3-Tier Agent System** - Orchestrates 11 specialized AI agents across 3 hierarchical tiers
- **Mastra Integration** - Leverages Mastra.ai for AI agent workflows and memory management
- **Portal Scraping** - Automated browser-based portal monitoring using Stagehand
- **Document Processing** - AI-powered PDF/Word parsing and requirement extraction
- **Proposal Generation** - GPT-4 and Claude 4.5 powered proposal writing
- **Real-time Communication** - WebSocket and SSE for live updates

## Directory Structure

```
server/
├── index.ts                 # Express server entry point
├── db.ts                   # Database connection and Drizzle setup
├── vite.ts                 # Vite integration for serving frontend
├── routes/                 # API route handlers
│   ├── rfps.routes.ts     # RFP CRUD operations
│   ├── proposals.routes.ts # Proposal generation and management
│   ├── portals.routes.ts  # Portal scanning and configuration
│   ├── agents.routes.ts   # Agent registry and status
│   ├── submissions.routes.ts # Submission pipeline
│   ├── workflows.routes.ts # Workflow orchestration
│   └── middleware/        # Express middleware
│       ├── errorHandling.ts # Global error handler
│       ├── rateLimiting.ts  # Rate limiters
│       └── cors.ts         # CORS configuration
├── services/              # Business logic layer
│   ├── agents/           # Agent registry and management
│   │   ├── agentRegistryService.ts # 11-agent registry
│   │   └── agentCoordinator.ts # Cross-agent coordination
│   ├── workflows/        # Workflow orchestration
│   │   ├── workflowCoordinator.ts # Tier-1 orchestrator
│   │   ├── mastraWorkflowEngine.ts # Mastra integration
│   │   └── discoveryWorkflowProcessors.ts # Portal discovery
│   ├── managers/         # Tier-2 Manager agents
│   │   ├── portalManager.ts # Portal management
│   │   ├── proposalManager.ts # Proposal coordination
│   │   └── researchManager.ts # Market research
│   ├── specialists/      # Tier-3 Specialist agents
│   │   ├── analysisSpecialists.ts # Document analysis
│   │   └── proposalGenerationSpecialists.ts # Content generation
│   ├── scrapers/         # Portal scraping services
│   │   ├── mastraScrapingService.ts # Mastra-based scraping
│   │   └── rfpScrapingService.ts # Legacy scraping
│   ├── scraping/         # Scraping infrastructure
│   │   ├── extraction/   # Data extraction logic
│   │   └── authentication/ # Portal authentication
│   ├── processing/       # Document processing
│   │   ├── documentParsingService.ts # PDF/Word parsing
│   │   └── documentIntelligenceService.ts # AI analysis
│   ├── proposals/        # Proposal services
│   │   ├── ai-proposal-service.ts # AI generation
│   │   └── enhancedProposalService.ts # Enhanced pipeline
│   ├── portals/          # Portal services
│   │   └── portal-scheduler-service.ts # Automated scanning
│   ├── monitoring/       # Monitoring and observability
│   │   └── portal-monitoring-service.ts # Health checks
│   ├── core/            # Core services
│   │   └── aiService.ts # AI model integration
│   ├── learning/        # Self-improving systems
│   │   └── persistentMemoryEngine.ts # SAFLA integration
│   └── benchmarks/      # Performance testing
│       ├── intelligenceBenchmarks.ts # Agent benchmarks
│       └── analysisTestRunner.ts # Test execution
├── repositories/         # Data access layer
│   ├── rfpRepository.ts # RFP database operations
│   ├── proposalRepository.ts # Proposal storage
│   └── portalRepository.ts # Portal configuration
├── utils/               # Utility functions
│   ├── logger.ts       # Winston structured logging
│   ├── apiResponse.ts  # Standardized API responses
│   ├── circuitBreaker.ts # Circuit breaker pattern
│   ├── retry.ts        # Retry logic with backoff
│   └── validation.ts   # Input validation helpers
├── middleware/         # Global middleware
├── jobs/              # Cron jobs and scheduled tasks
│   └── portalScanScheduler.ts # Automated portal scanning
├── scripts/           # Utility scripts
│   ├── run-migrations.ts # Database migration runner
│   └── apply-gin-indexes.js # PostgreSQL index creation
├── config/            # Configuration files
│   └── mastra.config.ts # Mastra configuration
└── CLAUDE.md         # This file
```

## Technology Stack

### Core Framework
- **Express 4.21+** - Web application framework
- **TypeScript 5.9+** - Type-safe Node.js development
- **tsx 4.20+** - TypeScript execution and hot reload
- **Node.js 18+** - JavaScript runtime

### Database & ORM
- **PostgreSQL 16+** - Primary relational database
- **Drizzle ORM 0.44+** - Type-safe SQL query builder
- **Drizzle Kit 0.31+** - Schema migration management
- **pg 8.16+** - PostgreSQL client

### AI & Agent System
- **Mastra.ai 0.21+** - AI agent framework and workflow engine
- **OpenAI SDK 6.5+** - GPT-4/GPT-5 integration
- **Anthropic AI SDK 2.0+** - Claude 4.5 integration
- **AI SDK 5.0+** - Unified AI model interface

### Web Scraping & Browser Automation
- **Stagehand 2.5+** - High-level browser automation (Browserbase)
- **Browserbase SDK 2.6+** - Cloud browser infrastructure
- **Cheerio 1.0** - HTML parsing and manipulation

### Document Processing
- **pdf-parse 2.4+** - PDF text extraction
- **pdf-lib 1.17+** - PDF manipulation and generation
- **mammoth 1.11+** - Word document (.docx) conversion
- **fast-xml-parser 5.3+** - XML parsing

### Real-time Communication
- **ws 8.18+** - WebSocket server implementation
- **Server-Sent Events (SSE)** - Unidirectional event streaming

### Logging & Monitoring
- **Winston 3.18+** - Structured logging
- **Sentry 10.20+** - Error tracking and performance monitoring

### Security & Authentication
- **jsonwebtoken 9.0+** - JWT token generation and validation
- **express-rate-limit 8.1+** - Rate limiting middleware

### Utilities
- **Zod 3.25+** - Runtime type validation
- **nanoid 5.1+** - Unique ID generation
- **node-cron 4.2+** - Scheduled task execution
- **p-limit 7.2+** - Concurrency control

## 3-Tier Agent System Architecture

### Tier 1: Primary Orchestrator (1 agent)

**Primary Orchestrator** (`workflowCoordinator.ts`)
- **Role**: Top-level orchestrator for all RFP operations
- **Responsibilities**:
  - Delegates tasks to Tier-2 Manager agents
  - Monitors system-wide progress and health
  - Coordinates cross-workflow dependencies
  - Handles high-level business logic
- **Key Methods**:
  - `delegateToManager()` - Assign tasks to managers
  - `monitorProgress()` - Track workflow execution
  - `handleEscalation()` - Manage failures and retries

### Tier 2: Manager Agents (3 agents)

#### Portal Manager (`portalManager.ts`)
- **Role**: Manages portal authentication and RFP discovery
- **Coordinates**:
  - Portal Scanner specialist (Tier 3)
  - Portal Monitor specialist (Tier 3)
- **Workflows**:
  - Automated portal scanning
  - Authentication handling (including 2FA)
  - RFP discovery and extraction

#### Proposal Manager (`proposalManager.ts`)
- **Role**: Coordinates proposal generation and compliance
- **Coordinates**:
  - Content Generator specialist (Tier 3)
  - Compliance Checker specialist (Tier 3)
  - Document Processor specialist (Tier 3)
- **Workflows**:
  - Proposal content generation
  - Compliance validation
  - Quality assurance

#### Research Manager (`researchManager.ts`)
- **Role**: Conducts market research and competitive intelligence
- **Coordinates**:
  - Market Analyst specialist (Tier 3)
  - Historical Analyzer specialist (Tier 3)
- **Workflows**:
  - Market research
  - Pricing strategy analysis
  - Win probability prediction

### Tier 3: Specialist Agents (7 agents)

1. **Portal Scanner** - Automated browser-based portal scanning
2. **Portal Monitor** - Health monitoring and scan scheduling
3. **Content Generator** - AI-powered proposal narrative generation
4. **Compliance Checker** - Requirements validation and compliance matrices
5. **Document Processor** - PDF/Word parsing and requirement extraction
6. **Market Analyst** - Competitive intelligence and pricing analysis
7. **Historical Analyzer** - Past bid performance and pattern recognition

## Key Services

### Agent Services

#### agentRegistryService.ts
**Purpose**: Central registry for all 11 AI agents
**Location**: `server/services/agents/agentRegistryService.ts`
**Features**:
- Agent registration and discovery
- Health monitoring and status tracking
- Capability-based agent selection
- Performance metrics collection

**Usage**:
```typescript
import { agentRegistryService } from './services/agents/agentRegistryService';

// Get agent by type
const portalManager = agentRegistryService.getAgent('portal-manager');

// Get all active agents
const activeAgents = agentRegistryService.getActiveAgents();

// Check agent health
const health = await agentRegistryService.checkAgentHealth('proposal-manager');
```

### Workflow Services

#### workflowCoordinator.ts
**Purpose**: Tier-1 orchestrator coordinating all workflows
**Location**: `server/services/workflows/workflowCoordinator.ts`
**Features**:
- Task delegation to manager agents
- Workflow state management
- Progress tracking and reporting
- Error handling and retries

**Key Workflows**:
1. **RFP Discovery** - Portal scanning → RFP extraction → Document download
2. **Proposal Generation** - Document parsing → Content generation → Compliance check
3. **Submission Pipeline** - Preflight checks → Authentication → Upload → Confirmation

#### mastraWorkflowEngine.ts
**Purpose**: Mastra.ai integration for AI-powered workflows
**Location**: `server/services/workflows/mastraWorkflowEngine.ts`
**Features**:
- Agent memory management
- Tool integration
- Workflow step execution
- Context preservation across steps

### Scraping Services

#### mastraScrapingService.ts
**Purpose**: Mastra-integrated portal scraping with AI
**Location**: `server/services/scrapers/mastraScrapingService.ts`
**Features**:
- Browser automation via Stagehand/Browserbase
- AI-powered element detection
- Portal authentication (including 2FA)
- Screenshot and session recording
- Incremental scanning support

**Usage**:
```typescript
import { getMastraScrapingService } from './services/scrapers/mastraScrapingService';

const scrapingService = await getMastraScrapingService();

// Start portal scan
const result = await scrapingService.scanPortal({
  portalId: 'portal-123',
  searchFilter: 'technology services',
  incrementalScan: true
});

// Monitor scan progress (emits SSE events)
scrapingService.on('progress', (event) => {
  console.log(`Progress: ${event.step} - ${event.progress}%`);
});
```

### Document Processing Services

#### documentIntelligenceService.ts
**Purpose**: AI-powered document analysis and requirement extraction
**Location**: `server/services/processing/documentIntelligenceService.ts`
**Features**:
- PDF and Word document parsing
- AI-based requirement extraction
- Compliance checklist generation
- Metadata extraction

**Usage**:
```typescript
import { documentIntelligenceService } from './services/processing/documentIntelligenceService';

// Process RFP document
const analysis = await documentIntelligenceService.processRFPDocument({
  rfpId: 'rfp-123',
  documentUrl: 'https://portal.gov/rfp.pdf',
  extractRequirements: true,
  generateCompliance: true
});

console.log(analysis.requirements); // Extracted requirements
console.log(analysis.complianceMatrix); // Compliance checklist
```

### Proposal Services

#### ai-proposal-service.ts
**Purpose**: AI-powered proposal content generation
**Location**: `server/services/proposals/ai-proposal-service.ts`
**Features**:
- GPT-4/Claude 4.5 integration
- Context-aware content generation
- Iterative refinement
- Quality scoring

**Usage**:
```typescript
import { aiProposalService } from './services/proposals/ai-proposal-service';

// Generate proposal
const proposal = await aiProposalService.generateProposal({
  rfpId: 'rfp-123',
  companyProfileId: 'company-123',
  sections: ['executive-summary', 'technical-approach', 'pricing'],
  qualityThreshold: 0.85
});
```

#### enhancedProposalService.ts
**Purpose**: Enhanced proposal pipeline with compliance and pricing
**Location**: `server/services/proposals/enhancedProposalService.ts`
**Features**:
- Multi-stage proposal generation
- Compliance validation integration
- Pricing table generation
- PDF assembly
- Real-time progress reporting (SSE)

### Portal Services

#### portal-scheduler-service.ts
**Purpose**: Automated portal scanning with cron scheduling
**Location**: `server/services/portals/portal-scheduler-service.ts`
**Features**:
- Configurable scan schedules (cron expressions)
- Priority-based execution
- Failure recovery and retries
- Scan history tracking

**Usage**:
```typescript
import { portalSchedulerService } from './services/portals/portal-scheduler-service';

// Schedule automated scan
await portalSchedulerService.schedulePortalScan({
  portalId: 'portal-123',
  schedule: '0 9 * * *', // Daily at 9 AM
  priority: 8,
  searchFilter: 'technology'
});
```

### Core Services

#### aiService.ts
**Purpose**: Unified AI model integration (OpenAI, Anthropic)
**Location**: `server/services/core/aiService.ts`
**Features**:
- Model selection and routing
- Token usage tracking
- Circuit breaker protection
- Retry logic
- Structured output with Zod schemas

**Usage**:
```typescript
import { AIService } from './services/core/aiService';

const aiService = new AIService();

// Generate with GPT-4
const response = await aiService.generateText({
  model: 'gpt-4',
  prompt: 'Analyze this RFP...',
  maxTokens: 2000,
  temperature: 0.7
});

// Generate with Claude
const claudeResponse = await aiService.generateText({
  model: 'claude-3-5-sonnet-20241022',
  prompt: 'Write executive summary...',
  schema: ExecutiveSummarySchema // Zod schema for structured output
});
```

## API Routes

### RFP Routes (`/api/rfps`)

```
GET    /api/rfps                # List RFPs with filtering
GET    /api/rfps/:id            # Get RFP details
POST   /api/rfps                # Create RFP
POST   /api/rfps/manual         # Submit manual RFP (triggers workflow)
PUT    /api/rfps/:id            # Update RFP
DELETE /api/rfps/:id            # Delete RFP
GET    /api/rfps/:id/documents  # Get RFP documents
```

### Proposal Routes (`/api/proposals`)

```
GET    /api/proposals                      # List proposals
GET    /api/proposals/:id                  # Get proposal details
POST   /api/proposals/enhanced/generate    # Generate enhanced proposal
POST   /api/proposals/pipeline/generate    # Bulk proposal generation
GET    /api/proposals/submission-materials/stream/:sessionId  # SSE progress
GET    /api/proposals/rfp/:rfpId           # Get proposals for RFP
```

### Portal Routes (`/api/portals`)

```
GET    /api/portals                # List portals
GET    /api/portals/:id            # Get portal details
POST   /api/portals/:id/scan       # Start portal scan
GET    /api/portals/:id/scan/stream # SSE scan progress
GET    /api/portals/:id/schedules  # Get scan schedules
POST   /api/portals/:id/schedules  # Create scan schedule
```

### Agent Routes (`/api/agents`)

```
GET    /api/agents                 # List all agents
GET    /api/agents/:agentId        # Get agent details
GET    /api/agents/:agentId/status # Get agent health status
POST   /api/agents/:agentId/execute # Execute agent task
```

### Workflow Routes (`/api/workflows`)

```
GET    /api/workflows              # List workflows
GET    /api/workflows/:id          # Get workflow status
POST   /api/workflows/rfp-discovery # Start RFP discovery workflow
POST   /api/workflows/proposal-generation # Start proposal workflow
```

### Health & System Routes

```
GET    /api/health                 # Quick health check
GET    /api/health/detailed        # Comprehensive health status
GET    /api/health/circuit-breakers # Circuit breaker status
GET    /api/health/ready           # Kubernetes readiness probe
GET    /api/health/live            # Kubernetes liveness probe
```

## How This Applies to the RFP Agent App

### Workflow Examples

#### 1. Manual RFP Submission Workflow
```
POST /api/rfps/manual
  ↓
Primary Orchestrator receives task
  ↓
Delegates to Portal Manager (Tier 2)
  ↓
Portal Manager coordinates:
  - Portal Scanner specialist → Downloads documents
  - Document Processor specialist → Parses PDF/Word
  ↓
Delegates to Proposal Manager (Tier 2)
  ↓
Proposal Manager coordinates:
  - Document Processor specialist → Extract requirements
  - Compliance Checker specialist → Generate compliance matrix
  ↓
RFP marked as "parsing complete" → User notified
```

#### 2. Automated Portal Scanning Workflow
```
Cron job triggers (via portal-scheduler-service)
  ↓
Primary Orchestrator initiates scan
  ↓
Delegates to Portal Manager
  ↓
Portal Manager coordinates:
  - Portal Scanner specialist → Launches browser automation
  - Authenticates to portal (handles 2FA if needed)
  - Searches for new RFPs
  - Extracts RFP metadata
  ↓
For each discovered RFP:
  - Document Processor downloads attachments
  - Document Intelligence Service extracts requirements
  - RFP saved to database with status "discovered"
  ↓
WebSocket notification sent to frontend
SSE progress updates streamed throughout
```

#### 3. Enhanced Proposal Generation Workflow
```
POST /api/proposals/enhanced/generate
  ↓
Primary Orchestrator receives task
  ↓
Delegates to Proposal Manager
  ↓
Proposal Manager coordinates specialists:
  - Document Processor → Extract requirements
  - Content Generator → Generate proposal sections
  - Compliance Checker → Validate compliance
  - Market Analyst → Analyze pricing (if requested)
  ↓
Iterative refinement:
  - Quality scoring each section
  - Regenerate if below threshold
  ↓
PDF assembly and finalization
  ↓
Proposal saved with status "review"
  ↓
Real-time progress via SSE stream
```

### Real-time Communication

#### WebSocket Channels

The server maintains persistent WebSocket connections for real-time updates:

```typescript
// server/services/websocketService.ts
websocketService.broadcastToChannel('rfps', {
  type: 'rfp:discovered',
  payload: rfpData,
  timestamp: new Date().toISOString()
});

websocketService.broadcastToChannel('agents', {
  type: 'agent:status_change',
  payload: { agentId, status: 'busy' },
  timestamp: new Date().toISOString()
});
```

**Channels**:
- `rfps` - RFP discovery and updates
- `proposals` - Proposal generation progress
- `agents` - Agent status changes
- `portals` - Portal scan events
- `submissions` - Submission pipeline updates

#### Server-Sent Events (SSE)

SSE streams provide unidirectional progress updates for long-running operations:

```typescript
// Portal scan progress
GET /api/portals/:id/scan/stream?scanId=scan_123

Events emitted:
- scan_started
- step_update (authentication, searching, extraction)
- rfp_discovered
- scan_completed / scan_failed

// Proposal generation progress
GET /api/proposals/submission-materials/stream/:sessionId

Events emitted:
- generation_started
- section_completed (executive-summary, technical-approach, etc.)
- quality_check
- generation_completed / generation_failed
```

### Database Integration

The server uses Drizzle ORM for type-safe database operations:

```typescript
import { db } from '../db';
import { rfps, proposals, portals } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Example: Fetch RFP with proposals
const rfpWithProposals = await db.query.rfps.findFirst({
  where: eq(rfps.id, rfpId),
  with: {
    proposals: true,
    portal: true,
    documents: true
  }
});
```

See [shared/CLAUDE.md](../shared/CLAUDE.md) for complete schema reference.

### Error Handling & Resilience

The server implements multiple resilience patterns:

#### Circuit Breaker Pattern
```typescript
import { withCircuitBreaker } from './utils/circuitBreaker';

// Protect external API calls
const result = await withCircuitBreaker(
  'openai-api',
  async () => await openai.chat.completions.create({...}),
  { failureThreshold: 5, timeout: 60000 }
);
```

#### Retry Logic
```typescript
import { retryHttp } from './utils/retry';

// Automatic retry with exponential backoff
const response = await retryHttp(
  async () => await fetch(portalUrl),
  { maxAttempts: 3, initialDelay: 1000 }
);
```

#### Structured Logging
```typescript
import { logger } from './utils/logger';

const log = logger.child({ rfpId, workflowId });
log.info('Starting proposal generation', { sections });
log.error('AI service failed', error, { attemptNumber: 2 });
log.performance('proposal-generation', duration, { sections: 5 });
```

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development|production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rfpagent

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Browser Automation
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...

# Portal API Keys
SAM_GOV_API_KEY=...

# Logging
LOG_LEVEL=debug|info|warn|error

# Mastra
MASTRA_API_KEY=...
```

## Development Guidelines

### Creating New Services

1. **Extend from base service class** (if applicable)
2. **Add structured logging** with service context
3. **Implement error handling** with try/catch and proper error types
4. **Use circuit breakers** for external service calls
5. **Add retry logic** for transient failures
6. **Document public methods** with JSDoc comments

Example:
```typescript
import { logger } from '../utils/logger';
import { withCircuitBreaker } from '../utils/circuitBreaker';
import { retry } from '../utils/retry';

export class NewService {
  private logger = logger.child({ service: 'NewService' });

  async processTask(taskId: string): Promise<Result> {
    this.logger.info('Processing task', { taskId });

    try {
      const data = await retry(
        async () => await this.fetchData(taskId),
        { maxAttempts: 3 }
      );

      const result = await withCircuitBreaker(
        'external-service',
        async () => await this.callExternalAPI(data)
      );

      this.logger.info('Task completed', { taskId, resultSize: result.length });
      return result;
    } catch (error) {
      this.logger.error('Task failed', error as Error, { taskId });
      throw error;
    }
  }
}
```

### Adding New Routes

1. Create route file in `server/routes/`
2. Use `handleAsyncError` middleware wrapper
3. Use `ApiResponse` helper for consistent responses
4. Add input validation with Zod schemas
5. Add appropriate rate limiting
6. Register route in `server/routes/index.ts`

Example:
```typescript
import { Router } from 'express';
import { handleAsyncError } from './middleware/errorHandling';
import { ApiResponse } from '../utils/apiResponse';
import { rateLimiter } from './middleware/rateLimiting';
import { z } from 'zod';

const router = Router();

const CreateResourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['typeA', 'typeB'])
});

router.post('/resources',
  rateLimiter,
  handleAsyncError(async (req, res) => {
    const validated = CreateResourceSchema.parse(req.body);
    const resource = await createResource(validated);
    return ApiResponse.success(res, resource, { message: 'Resource created' });
  })
);

export default router;
```

## Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Test specific services
npm run test-agents        # Test agent system
npm run test-proposal      # Test proposal generation
npm run test-compliance    # Test compliance integration
```

## Deployment

### Database Migrations

```bash
# Push schema changes
npm run db:push

# Run migrations
npm run db:migrate
```

### Production Build

```bash
# Build frontend and backend
npm run build

# Start production server
npm start
```

### Health Checks

Kubernetes probes:
- **Liveness**: `GET /api/health/live` - Basic server responsiveness
- **Readiness**: `GET /api/health/ready` - Database + essential services health

## Monitoring & Observability

- **Structured Logs** - JSON-formatted logs with correlation IDs
- **Sentry Integration** - Error tracking and performance monitoring
- **Health Endpoints** - Comprehensive health checks with service breakdown
- **Circuit Breaker Metrics** - Track external service health
- **Agent Metrics** - Monitor agent performance and task completion rates

See [docs/technical/logging-and-observability.md](../docs/technical/logging-and-observability.md) for details.

## Related Documentation

- **Frontend**: See [client/CLAUDE.md](../client/CLAUDE.md) for frontend integration
- **Shared Types**: See [shared/CLAUDE.md](../shared/CLAUDE.md) for database schema
- **API Reference**: See [docs/api/README.md](../docs/api/README.md) for complete API documentation
- **Agent Architecture**: See [docs/technical/agents-architecture.md](../docs/technical/agents-architecture.md)
- **Testing Guide**: See [docs/testing/testing-guide.md](../docs/testing/testing-guide.md)

---

**For the main RFP Agent configuration and SPARC workflow, see the root [CLAUDE.md](../CLAUDE.md)**
