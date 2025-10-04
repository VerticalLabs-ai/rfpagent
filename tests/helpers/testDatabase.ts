import { storage } from '../../server/storage';
import { nanoid } from 'nanoid';

/**
 * Test Database Helpers
 *
 * Utilities for setting up and tearing down test data in the database.
 */

export interface TestSession {
  sessionId: string;
  userId: string;
  cleanup: () => Promise<void>;
}

export interface TestWorkflow {
  workflowId: string;
  sessionId: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a test user for testing
 */
export async function createTestUser(overrides: Partial<any> = {}): Promise<any> {
  const uniqueId = nanoid(10);
  const user = await storage.createUser({
    username: `test_user_${uniqueId}`,
    password: 'test-password-hash-123',
    passwordHash: 'test-hash',
    name: `Test User ${uniqueId}`,
    email: `test_${uniqueId}@example.com`,
    role: 'user',
    ...overrides,
  });
  return user;
}

/**
 * Create a test agent session
 */
export async function createTestSession(sessionId?: string): Promise<TestSession> {
  const user = await createTestUser();
  const sid = sessionId || `test_session_${nanoid()}`;

  await storage.createAgentSession({
    sessionId: sid,
    userId: user.id,
    conversationId: null,
    state: { test: true },
    context: { testMode: true },
    status: 'active',
  });

  return {
    sessionId: sid,
    userId: user.id,
    cleanup: async () => {
      // Cleanup will be handled by test teardown
    },
  };
}

/**
 * Create a test workflow
 */
export async function createTestWorkflow(sessionId: string): Promise<TestWorkflow> {
  const workflowId = `workflow_${nanoid()}`;

  await storage.createWorkflowState({
    workflowId,
    sessionId,
    currentPhase: 'discovery',
    status: 'pending',
    progress: 0,
    context: { test: true },
  });

  return {
    workflowId,
    sessionId,
    cleanup: async () => {
      // Cleanup will be handled by test teardown
    },
  };
}

/**
 * Create a test portal
 */
export async function createTestPortal(overrides: Partial<any> = {}): Promise<any> {
  return await storage.createPortal({
    name: `Test Portal ${nanoid(6)}`,
    url: 'https://test-portal.example.com',
    type: 'federal',
    status: 'active',
    authType: 'none',
    scrapingEnabled: true,
    selectors: {},
    ...overrides,
  });
}

/**
 * Create a test RFP
 */
export async function createTestRFP(portalId: string, overrides: Partial<any> = {}): Promise<any> {
  return await storage.createRFP({
    portalId,
    externalId: `test_rfp_${nanoid(6)}`,
    title: 'Test RFP',
    description: 'Test RFP Description',
    agency: 'Test Agency',
    postedDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'open',
    url: 'https://test-portal.example.com/rfp/123',
    categories: [],
    estimatedValue: null,
    ...overrides,
  });
}

/**
 * Create a test proposal
 */
export async function createTestProposal(rfpId: string, userId: string, overrides: Partial<any> = {}): Promise<any> {
  return await storage.createProposal({
    rfpId,
    userId,
    title: 'Test Proposal',
    content: { sections: [] },
    status: 'draft',
    version: 1,
    ...overrides,
  });
}

/**
 * Clean up all test data created during tests
 */
export async function cleanupTestData(): Promise<void> {
  // This will be called in afterAll/afterEach
  // For now, we rely on the test database being reset between test runs
  console.log('🧹 Test cleanup completed');
}

/**
 * Seed the database with minimal test data
 */
export async function seedTestDatabase(): Promise<{
  user: any;
  session: TestSession;
  portal: any;
  rfp: any;
}> {
  const user = await createTestUser();
  const session = await createTestSession();
  const portal = await createTestPortal();
  const rfp = await createTestRFP(portal.id);

  return { user, session, portal, rfp };
}
