# Client Directory - RFP Agent Frontend

**Last Updated**: January 2025

## Overview

The `client/` directory contains the React-based frontend application for the RFP Agent platform. Built with Vite, React, TypeScript, and TailwindCSS, it provides an intuitive interface for managing RFP discovery, proposal generation, and submission workflows.

## Purpose

This directory serves as the complete frontend application that:

- **Provides user interface** for RFP discovery, proposal generation, and submission tracking
- **Real-time updates** via WebSocket and Server-Sent Events (SSE) connections
- **Interactive dashboards** for monitoring portal scans and AI agent workflows
- **Component library** built with Radix UI and shadcn/ui for consistent UX
- **AI chat interface** for natural language interaction with the system

## Directory Structure

```
client/
├── src/
│   ├── components/        # Reusable React components
│   │   ├── ui/           # Base UI components (shadcn/ui)
│   │   ├── rfps/         # RFP-specific components
│   │   ├── proposals/    # Proposal-specific components
│   │   ├── portals/      # Portal management components
│   │   └── chat/         # AI chat interface components
│   ├── pages/            # Top-level page components
│   │   ├── Dashboard.tsx # Main dashboard
│   │   ├── RFPList.tsx   # RFP listing and filtering
│   │   ├── ProposalGenerator.tsx # Proposal creation
│   │   └── PortalScanner.tsx # Portal scanning interface
│   ├── hooks/            # Custom React hooks
│   │   ├── useWebSocket.ts # WebSocket connection management
│   │   ├── useSSE.ts     # Server-Sent Events handling
│   │   ├── useRFPs.ts    # RFP data fetching and state
│   │   └── useAgents.ts  # Agent status monitoring
│   ├── lib/              # Utility libraries
│   │   ├── api.ts        # API client configuration
│   │   ├── utils.ts      # Helper functions
│   │   └── queryClient.ts # React Query setup
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── App.tsx           # Root application component
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles
├── index.html            # HTML template
└── CLAUDE.md            # This file

**Key Configuration Files** (in project root):
- `vite.config.ts` - Vite build configuration
- `tailwind.config.ts` - TailwindCSS theme configuration
- `tsconfig.json` - TypeScript compiler settings
```

## Technology Stack

### Core Framework
- **React 18.3+** - UI framework with hooks and concurrent features
- **TypeScript 5.9+** - Type-safe JavaScript development
- **Vite 7.1+** - Fast build tool and dev server
- **Wouter 3.7+** - Lightweight client-side routing

### UI Components
- **Radix UI** - Accessible, unstyled component primitives
- **shadcn/ui** - Re-usable component library built on Radix UI
- **TailwindCSS 3.4+** - Utility-first CSS framework
- **Lucide React** - Icon library

### State Management
- **TanStack Query 5.90+** - Server state management and caching
- **React Hook Form 7.65+** - Form state and validation
- **Zod 3.25+** - Schema validation

### Real-time Communication
- **WebSocket (ws 8.18+)** - Bidirectional real-time updates
- **Server-Sent Events (SSE)** - Unidirectional event streaming for progress updates

### Data Visualization
- **Recharts 3.3+** - Chart and data visualization library
- **React Markdown 10.1+** - Markdown rendering for proposals

## Key Components

### Pages

#### Dashboard.tsx
**Purpose**: Main application dashboard with overview metrics and recent activity
**Location**: `client/src/pages/Dashboard.tsx`
**Features**:
- System health indicators
- Active RFP count and status
- Recent proposals
- Portal scan status
- Real-time agent activity

#### RFPList.tsx
**Purpose**: Comprehensive RFP listing with filtering and search
**Location**: `client/src/pages/RFPList.tsx`
**Features**:
- Filterable table of all RFPs
- Status-based filtering (discovered, parsing, drafting, etc.)
- Search by title, agency, category
- Pagination support
- Quick actions (generate proposal, view details)

#### ProposalGenerator.tsx
**Purpose**: AI-powered proposal generation interface
**Location**: `client/src/pages/ProposalGenerator.tsx`
**Features**:
- RFP selection
- Company profile selection
- Generation options configuration
- Real-time progress monitoring via SSE
- Preview and download generated proposals

#### PortalScanner.tsx
**Purpose**: Portal scanning configuration and monitoring
**Location**: `client/src/pages/PortalScanner.tsx`
**Features**:
- Portal configuration
- Scan initiation
- Real-time scan progress (SSE)
- Discovered RFP preview
- Scan history

### Components

#### `/components/ui/`
**shadcn/ui base components** - Accessible, styled primitives:
- `Button`, `Input`, `Select`, `Dialog`
- `Card`, `Table`, `Tabs`, `Accordion`
- `Toast`, `Alert`, `Progress`
- See [shadcn/ui documentation](https://ui.shadcn.com)

#### `/components/rfps/`
**RFP-specific components**:
- `RFPCard` - Display RFP summary
- `RFPDetails` - Full RFP information modal
- `RFPStatusBadge` - Visual status indicator
- `RFPTimeline` - Processing timeline visualization

#### `/components/proposals/`
**Proposal-specific components**:
- `ProposalCard` - Proposal summary card
- `ProposalPreview` - Markdown preview of generated content
- `ComplianceMatrix` - Compliance requirement checklist
- `PricingTable` - Interactive pricing table

#### `/components/chat/`
**AI chat interface**:
- `ChatWindow` - Main chat container
- `MessageBubble` - Individual message component
- `ChatInput` - Message composition interface
- `AgentTypingIndicator` - Shows active AI agents

### Hooks

#### useWebSocket.ts
**Purpose**: WebSocket connection management
**Location**: `client/src/hooks/useWebSocket.ts`
**Usage**:
```typescript
const { connected, subscribe, unsubscribe } = useWebSocket();

// Subscribe to RFP updates
subscribe('rfps', (message) => {
  if (message.type === 'rfp:discovered') {
    console.log('New RFP:', message.payload);
  }
});
```

#### useSSE.ts
**Purpose**: Server-Sent Events for progress tracking
**Location**: `client/src/hooks/useSSE.ts`
**Usage**:
```typescript
const { events, error, close } = useSSE(`/api/portals/${portalId}/scan/stream?scanId=${scanId}`);

events.forEach(event => {
  if (event.type === 'scan_progress') {
    setProgress(event.progress);
  }
});
```

#### useRFPs.ts
**Purpose**: RFP data fetching and management
**Location**: `client/src/hooks/useRFPs.ts`
**Usage**:
```typescript
const { data: rfps, isLoading, refetch } = useRFPs({
  status: 'discovered',
  page: 1,
  limit: 20
});
```

#### useAgents.ts
**Purpose**: Monitor AI agent status and activity
**Location**: `client/src/hooks/useAgents.ts`
**Usage**:
```typescript
const { agents, activeCount } = useAgents();
// Returns list of active agents with their current tasks
```

## How This Applies to the RFP Agent App

### User Workflows

#### 1. Manual RFP Submission
```
User selects "Submit RFP" → Enters RFP URL → System processes →
Real-time updates via SSE → Displays extracted information →
User confirms → RFP added to system
```

**Components Used**: `RFPManualSubmission`, SSE progress display

#### 2. Automated Portal Scanning
```
User configures portal scan → Initiates scan →
Real-time progress via SSE → Displays discovered RFPs →
User reviews and selects RFPs for proposals
```

**Components Used**: `PortalScanner`, `RFPCard`, SSE event handler

#### 3. Proposal Generation
```
User selects RFP → Chooses company profile →
Configures generation options → Monitors progress (SSE) →
Reviews generated proposal → Edits if needed → Approves for submission
```

**Components Used**: `ProposalGenerator`, `ProposalPreview`, `ComplianceMatrix`

#### 4. AI Chat Interaction
```
User types question → AI processes using RAG and agent system →
Displays response with relevant RFPs/proposals →
User can drill down into details
```

**Components Used**: `ChatWindow`, `MessageBubble`, `RFPCard`

### Real-time Features

The frontend leverages real-time communication for:

1. **WebSocket Channels**:
   - `rfps` - New RFP discoveries
   - `proposals` - Proposal generation updates
   - `agents` - Agent status changes
   - `submissions` - Submission pipeline progress

2. **SSE Streams**:
   - Portal scan progress
   - Proposal generation steps
   - Document processing status
   - Compliance validation results

### State Management

- **Server State** (TanStack Query):
  - RFP listings
  - Proposal data
  - Portal configurations
  - Agent registry

- **Local State** (React hooks):
  - UI interactions
  - Form state
  - Real-time updates buffer
  - Navigation state

## Development Guidelines

### Component Creation

When creating new components:

1. **Use TypeScript** - All components must be typed
2. **Favor composition** - Build from smaller, reusable pieces
3. **Use shadcn/ui** - Leverage existing UI primitives
4. **Handle loading states** - Always show loading/error states
5. **Add accessibility** - Use ARIA labels and semantic HTML

Example:
```tsx
interface RFPCardProps {
  rfp: RFP;
  onSelect?: (id: string) => void;
}

export function RFPCard({ rfp, onSelect }: RFPCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{rfp.title}</CardTitle>
        <RFPStatusBadge status={rfp.status} />
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{rfp.agency}</p>
        <p className="text-xs">Deadline: {formatDate(rfp.deadline)}</p>
      </CardContent>
      {onSelect && (
        <CardFooter>
          <Button onClick={() => onSelect(rfp.id)}>View Details</Button>
        </CardFooter>
      )}
    </Card>
  );
}
```

### Styling Guidelines

- **Use Tailwind utilities** - Prefer Tailwind over custom CSS
- **Follow design system** - Use theme variables from `tailwind.config.ts`
- **Responsive design** - Mobile-first approach with breakpoints
- **Dark mode support** - Use `dark:` variants for dark mode

### API Integration

All API calls should use the configured client in `lib/api.ts`:

```typescript
import { api } from '@/lib/api';

// Good
const rfps = await api.get('/api/rfps', { params: { status: 'discovered' } });

// Avoid direct fetch calls
// const response = await fetch('/api/rfps'); // Don't do this
```

### Error Handling

Implement proper error boundaries and toast notifications:

```typescript
import { toast } from '@/components/ui/use-toast';

try {
  await generateProposal(rfpId);
  toast({
    title: "Success",
    description: "Proposal generation started",
  });
} catch (error) {
  toast({
    title: "Error",
    description: error.message,
    variant: "destructive",
  });
}
```

## Testing

### Component Testing

```bash
# Run component tests
npm run test

# Watch mode
npm run test:watch
```

### E2E Testing

Integration tests with Playwright:

```bash
# Run E2E tests
npm run test:e2e

# Interactive mode
npm run test:e2e:ui
```

## Build and Deployment

### Development
```bash
npm run dev:frontend
# Runs Vite dev server on http://localhost:5173
```

### Production Build
```bash
npm run build
# Builds to /dist directory
# Optimizes and minifies assets
# Generates source maps
```

### Environment Variables

Frontend environment variables (`.env`):
```bash
VITE_API_URL=http://localhost:3000  # Backend API URL
VITE_WS_URL=ws://localhost:3000     # WebSocket URL
```

## Related Documentation

- **Backend API**: See [server/CLAUDE.md](../server/CLAUDE.md) for API endpoints
- **Shared Types**: See [shared/CLAUDE.md](../shared/CLAUDE.md) for shared schema definitions
- **API Documentation**: See [docs/api/README.md](../docs/api/README.md) for API reference
- **Testing Guide**: See [docs/testing/testing-guide.md](../docs/testing/testing-guide.md)

## Common Tasks

### Adding a New Page

1. Create page component in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`
3. Update navigation in `src/components/Navigation.tsx`
4. Add to TypeScript types if needed

### Adding a New API Endpoint

1. Add API method to `src/lib/api.ts`
2. Create custom hook in `src/hooks/useNewFeature.ts`
3. Use hook in component
4. Handle loading and error states

### Adding Real-time Updates

1. Subscribe to WebSocket channel in component
2. Handle incoming messages
3. Update local state or trigger React Query refetch
4. Clean up subscription on unmount

## Integration with RFP Agent System

The frontend integrates with the following backend services:

- **REST API** (`/api/*`) - Standard CRUD operations
- **WebSocket** (`/ws`) - Real-time bidirectional communication
- **SSE Endpoints** (`/api/*/stream`) - Unidirectional progress updates
- **Agent System** - Displays status of 11 AI agents (3-tier architecture)
- **Mastra Integration** - Shows workflow execution and AI processing

For complete system architecture, see [docs/architecture/](../docs/architecture/)

---

**For the main RFP Agent configuration and SPARC workflow, see the root [CLAUDE.md](../CLAUDE.md)**
