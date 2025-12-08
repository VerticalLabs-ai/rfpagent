import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Response object
const createMockResponse = () => {
  const res = {
    writeHead: vi.fn(),
    write: vi.fn().mockReturnValue(true),
    end: vi.fn(),
    on: vi.fn(),
    destroyed: false,
  };
  return res;
};

describe('ProgressTracker SSE Connection', () => {
  let progressTracker: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    // Import fresh instance
    const module = await import('../../server/services/monitoring/progressTracker');
    progressTracker = module.progressTracker;
  });

  afterEach(() => {
    vi.useRealTimers();
    progressTracker.shutdown();
  });

  it('should set X-Accel-Buffering header to disable proxy buffering', async () => {
    const mockRes = createMockResponse();
    progressTracker.registerSSEClient('test-session', mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'X-Accel-Buffering': 'no',
    }));
  });

  it('should send heartbeat every 15 seconds instead of 30', async () => {
    const mockRes = createMockResponse();
    progressTracker.registerSSEClient('test-session', mockRes);

    // Initial connected message
    expect(mockRes.write).toHaveBeenCalledTimes(1);

    // Advance 15 seconds
    vi.advanceTimersByTime(15000);

    // Should have sent heartbeat (comment-style + data-style = 2 writes)
    expect(mockRes.write).toHaveBeenCalledTimes(3); // 1 initial + 2 heartbeat writes
    const heartbeatCall = mockRes.write.mock.calls[1][0];
    expect(heartbeatCall).toContain('heartbeat');
  });

  it('should use comment-style heartbeat for better proxy compatibility', async () => {
    const mockRes = createMockResponse();
    progressTracker.registerSSEClient('test-session', mockRes);

    vi.advanceTimersByTime(15000);

    const heartbeatCall = mockRes.write.mock.calls[1][0];
    // Should include both comment and data format for maximum compatibility
    expect(heartbeatCall).toMatch(/^: heartbeat/);
  });

  it('should track last activity timestamp per client', async () => {
    const mockRes = createMockResponse();
    progressTracker.registerSSEClient('test-session', mockRes);

    // Internal implementation should track activity
    const clientInfo = progressTracker.getClientInfo('test-session');
    expect(clientInfo).toBeDefined();
    expect(clientInfo.lastActivity).toBeDefined();
  });
});
