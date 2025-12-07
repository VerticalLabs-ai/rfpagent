/**
 * Real-time agent work tracking for RFPs
 */

export interface AgentWorkSession {
  sessionId: string;
  rfpId: string;
  rfpTitle: string;
  agentId: string;
  agentDisplayName: string;
  agentTier: 'orchestrator' | 'manager' | 'specialist';
  taskType: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'paused';
  progress: number; // 0-100
  currentStep: string | null;
  startedAt: string;
  estimatedCompletionAt: string | null;
  completedAt: string | null;
  error: string | null;
  metrics: {
    tokensUsed?: number;
    executionTimeMs?: number;
    retryCount?: number;
  };
}

export interface RfpAgentWorkSummary {
  rfpId: string;
  rfpTitle: string;
  agency: string;
  status: string;
  activeSessions: AgentWorkSession[];
  completedSessions: AgentWorkSession[];
  totalAgentsAssigned: number;
  overallProgress: number; // Aggregate progress 0-100
  estimatedCompletion: string | null;
}

export interface AgentQueueItem {
  id: string;
  rfpId: string;
  rfpTitle: string;
  agentId: string;
  agentDisplayName: string;
  priority: number; // 1-10
  position: number; // Queue position
  estimatedStartTime: string | null;
  createdAt: string;
}

export interface AgentResourceAllocation {
  agentId: string;
  agentDisplayName: string;
  tier: string;
  currentLoad: number; // 0-100
  maxConcurrentTasks: number;
  activeTasks: number;
  queuedTasks: number;
  avgTaskDuration: number; // seconds
}

export interface AgentPriorityUpdate {
  rfpId: string;
  agentId: string;
  newPriority: number;
}

export interface CustomizableAgent {
  agentId: string;
  displayName: string;
  tier: 'orchestrator' | 'manager' | 'specialist';
  description: string;
  supportsCustomPrompt: boolean;
}

export interface CompanyAgentConfig {
  agentId: string;
  displayName: string;
  tier: string;
  description: string;
  supportsCustomPrompt: boolean;
  customPrompt: string | null;
  priority: number;
  isEnabled: boolean;
  settings: Record<string, unknown> | null;
  hasCustomization: boolean;
}

// WebSocket message types for real-time updates
export type AgentTrackingMessage =
  | { type: 'agent:work_started'; payload: AgentWorkSession }
  | { type: 'agent:progress_update'; payload: { sessionId: string; progress: number; currentStep: string } }
  | { type: 'agent:work_completed'; payload: { sessionId: string; result: unknown } }
  | { type: 'agent:work_failed'; payload: { sessionId: string; error: string } }
  | { type: 'agent:queue_updated'; payload: AgentQueueItem[] }
  | { type: 'agent:resource_update'; payload: AgentResourceAllocation[] };
