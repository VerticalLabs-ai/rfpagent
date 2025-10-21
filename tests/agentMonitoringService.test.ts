import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const storageModulePath = '../server/storage';
const workflowCoordinatorModulePath = '../server/services/workflows/workflowCoordinator';
const agentMonitoringModulePath = '../server/services/agents/agentMonitoringService';

type AgentMonitoringModule = typeof import('../server/services/agents/agentMonitoringService');

type WorkflowStateRow = {
  workflowId: string;
  currentPhase: string;
  status: string;
  progress: unknown;
  updatedAt: Date | null;
  context?: Record<string, unknown> | null;
};

type PhaseMetricsRecord = Record<string, Partial<Record<'active' | 'completed' | 'failed' | 'avgDuration', unknown>>>;

type PhaseTransitionSummary = {
  totalTransitions: number;
  successfulTransitions: number;
  failedTransitions: number;
  averageTransitionTime: number;
};

const mockStorage = {
  getRecentWorkflowStates: jest.fn() as jest.MockedFunction<() => Promise<WorkflowStateRow[]>>,
  getPhaseTransitionSummary: jest.fn() as jest.MockedFunction<() => Promise<PhaseTransitionSummary>>,
};

const mockWorkflowCoordinator = {
  getGlobalWorkflowState: jest.fn() as jest.MockedFunction<() => Promise<any>>,
  getPhaseStatistics: jest.fn() as jest.MockedFunction<() => Promise<PhaseMetricsRecord>>,
};

describe('agentMonitoringService', () => {
  let agentMonitoringService: AgentMonitoringModule['agentMonitoringService'];

  beforeAll(async () => {
    jest.resetModules();
    await jest.unstable_mockModule(storageModulePath, () => ({
      __esModule: true,
      storage: mockStorage,
    }));

    await jest.unstable_mockModule(workflowCoordinatorModulePath, () => ({
      __esModule: true,
      workflowCoordinator: mockWorkflowCoordinator,
    }));

    ({ agentMonitoringService } = await import(agentMonitoringModulePath));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps workflow overview metadata and global state consistently', async () => {
    mockWorkflowCoordinator.getGlobalWorkflowState.mockResolvedValue({
      activeWorkflows: 3,
      byPhase: { discovery: 2, submission: 1 },
      byStatus: { active: 2, suspended: 1 },
      recentlyCompleted: [
        {
          workflowId: 'wf-99',
          phase: 'submission',
          completedAt: new Date('2025-01-01T12:00:00.000Z'),
        },
      ],
    });

    mockStorage.getRecentWorkflowStates.mockResolvedValue([
      {
        workflowId: 'wf-1',
        currentPhase: 'discovery',
        status: 'active',
        progress: '75',
        updatedAt: new Date('2025-01-01T11:00:00.000Z'),
        context: {
          rfp: { title: 'Downtown Streetscape', agency: 'City of Philadelphia' },
        },
      },
      {
        workflowId: 'wf-2',
        currentPhase: 'submission',
        status: 'suspended',
        progress: null,
        updatedAt: null,
        context: {
          title: 'Broad Street Lighting',
          customer: 'PA DOT',
        },
      },
    ]);

    const overview = await agentMonitoringService.getWorkflowOverview();

    expect(overview.activeWorkflows).toBe(3);
    expect(overview.byPhase).toEqual({ discovery: 2, submission: 1 });
    expect(overview.byStatus).toEqual({ active: 2, suspended: 1 });
    expect(overview.recentlyCompleted).toEqual([
      {
        workflowId: 'wf-99',
        phase: 'submission',
        completedAt: '2025-01-01T12:00:00.000Z',
      },
    ]);
    expect(overview.workflows).toEqual([
      {
        workflowId: 'wf-1',
        currentPhase: 'discovery',
        status: 'active',
        progress: 75,
        title: 'Downtown Streetscape',
        agency: 'City of Philadelphia',
        updatedAt: '2025-01-01T11:00:00.000Z',
      },
      {
        workflowId: 'wf-2',
        currentPhase: 'submission',
        status: 'suspended',
        progress: 0,
        title: 'Broad Street Lighting',
        agency: 'PA DOT',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('normalizes phase statistics metrics to numbers and returns transitions summary', async () => {
    mockWorkflowCoordinator.getPhaseStatistics.mockResolvedValue({
      discovery: { active: '5', completed: 10, failed: 1, avgDuration: '3600' },
      submission: { active: undefined, completed: '4', failed: '2', avgDuration: null },
    });

    mockStorage.getPhaseTransitionSummary.mockResolvedValue({
      totalTransitions: 42,
      successfulTransitions: 39,
      failedTransitions: 3,
      averageTransitionTime: 18.5,
    });

    const stats = await agentMonitoringService.getPhaseStatistics();

    expect(stats.phases).toEqual({
      discovery: { active: 5, completed: 10, failed: 1, avgDuration: 3600 },
      submission: { active: 0, completed: 4, failed: 2, avgDuration: 0 },
    });

    expect(stats.transitions).toEqual({
      totalTransitions: 42,
      successfulTransitions: 39,
      failedTransitions: 3,
      averageTransitionTime: 18.5,
    });
  });
});
