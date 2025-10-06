# RFP Agent Platform - Quick Start Implementation Guide

**Purpose:** Get the top 3 priority items implemented in the next 2 weeks
**Target Audience:** Engineering team starting Phase 1
**Date:** 2025-10-02

---

## Overview

This guide walks through implementing the **highest priority infrastructure changes** to unblock scaling and improve user experience. Focus on these 3 items first:

1. **Redis Cluster** (Week 1) - Foundation for caching and real-time features
2. **WebSocket Real-Time** (Week 1-2) - Game-changing UX improvement
3. **BullMQ Task Queue** (Week 2) - Enables distributed processing

---

## Prerequisites

Before starting, ensure you have:
- [ ] AWS account (or GCP/Azure equivalent)
- [ ] Node.js 18+ installed
- [ ] pnpm installed
- [ ] Access to production database (Neon PostgreSQL)
- [ ] Browserbase API credentials
- [ ] OpenAI API key

---

## Week 1: Redis Cluster Setup

### Step 1.1: Provision Redis Cluster

**Option A: AWS ElastiCache (Recommended)**

```bash
# Using AWS CLI
aws elasticache create-replication-group \
  --replication-group-id rfp-agent-redis \
  --replication-group-description "RFP Agent Redis Cluster" \
  --engine redis \
  --cache-node-type cache.t3.medium \
  --num-cache-clusters 3 \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --engine-version 7.0 \
  --port 6379
```

**Option B: Redis Cloud (Alternative)**

1. Go to https://redis.com/try-free/
2. Create account
3. Choose "Fixed" plan (starts at $7/month)
4. Select 3 nodes for HA
5. Copy connection string

**Option C: Docker for Development**

```bash
# For local development only
docker run -d --name redis-dev \
  -p 6379:6379 \
  redis:7.0-alpine
```

### Step 1.2: Install Dependencies

```bash
cd /Users/mgunnin/Developer/08_Clients/ibyte/rfpagent

# Install Redis clients
pnpm add ioredis @types/ioredis

# Install session middleware
pnpm add connect-redis express-session @types/express-session
```

### Step 1.3: Create Redis Client Singleton

Create `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/services/redisClient.ts`:

```typescript
import Redis, { RedisOptions } from 'ioredis';

class RedisClientManager {
  private static instance: RedisClientManager;
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  private constructor() {
    const options: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
    };

    // Main client for general operations
    this.client = new Redis(options);

    // Subscriber for pub/sub (separate connection required)
    this.subscriber = new Redis(options);

    // Publisher for pub/sub
    this.publisher = new Redis(options);

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('connect', () => {
      console.log('✅ Redis client connected');
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis client error:', err);
    });

    this.subscriber.on('connect', () => {
      console.log('✅ Redis subscriber connected');
    });

    this.publisher.on('connect', () => {
      console.log('✅ Redis publisher connected');
    });
  }

  public static getInstance(): RedisClientManager {
    if (!RedisClientManager.instance) {
      RedisClientManager.instance = new RedisClientManager();
    }
    return RedisClientManager.instance;
  }

  public getClient(): Redis {
    return this.client;
  }

  public getSubscriber(): Redis {
    return this.subscriber;
  }

  public getPublisher(): Redis {
    return this.publisher;
  }

  public async disconnect(): Promise<void> {
    await Promise.all([
      this.client.quit(),
      this.subscriber.quit(),
      this.publisher.quit(),
    ]);
  }
}

export const redisClientManager = RedisClientManager.getInstance();
export const redisClient = redisClientManager.getClient();
export const redisSubscriber = redisClientManager.getSubscriber();
export const redisPublisher = redisClientManager.getPublisher();
```

### Step 1.4: Create Caching Service

Create `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/services/cacheService.ts`:

```typescript
import { redisClient } from './redisClient';

export class CacheService {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL (seconds)
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get cache stats
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    hitRate: number;
  }> {
    try {
      const info = await redisClient.info('stats');
      const keyspace = await redisClient.info('keyspace');

      // Parse stats
      const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
      const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
      const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0;

      const keys = parseInt(keyspace.match(/keys=(\d+)/)?.[1] || '0');
      const memory = info.match(/used_memory_human:(.+)/)?.[1] || 'Unknown';

      return {
        keys,
        memory,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { keys: 0, memory: 'Unknown', hitRate: 0 };
    }
  }
}

export const cacheService = new CacheService();
```

### Step 1.5: Update Session Storage

Update `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/index.ts`:

```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';
import { redisClient } from './services/redisClient';

// ... existing imports ...

// Add session middleware
app.use(
  session({
    store: new RedisStore({
      client: redisClient,
      prefix: 'session:',
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// ... rest of server setup ...
```

### Step 1.6: Add Caching to Routes

Example: Cache portal list

Update `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/routes/portals.routes.ts`:

```typescript
import { cacheService } from '../services/cacheService';

// GET /api/portals
app.get('/api/portals', async (req, res) => {
  try {
    const cacheKey = 'portals:list';

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Cache miss - query database
    const portals = await storage.getPortals();

    // Cache for 5 minutes
    await cacheService.set(cacheKey, portals, 300);

    res.json(portals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portals' });
  }
});

// When portal is updated, invalidate cache
app.put('/api/portals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const portal = await storage.updatePortal(id, req.body);

    // Invalidate cache
    await cacheService.deletePattern('portals:*');

    res.json(portal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update portal' });
  }
});
```

### Step 1.7: Environment Variables

Add to `.env`:

```bash
# Redis Configuration
REDIS_HOST=your-redis-host.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password  # If using password auth
SESSION_SECRET=generate-random-secret-here
```

---

## Week 1-2: WebSocket Real-Time Communication

### Step 2.1: Install Dependencies

```bash
pnpm add socket.io @socket.io/redis-adapter
```

### Step 2.2: Create WebSocket Service

Create `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/services/websocketService.ts`:

```typescript
import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisPublisher, redisSubscriber } from './redisClient';

class WebSocketService {
  private io: Server | null = null;
  private initialized = false;

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    if (this.initialized) {
      console.warn('WebSocket service already initialized');
      return;
    }

    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true,
      },
      path: '/ws',
      transports: ['websocket', 'polling'], // Fallback to polling
    });

    // Use Redis adapter for multi-server support
    this.io.adapter(createAdapter(redisPublisher, redisSubscriber));

    this.setupEventHandlers();
    this.initialized = true;

    console.log('✅ WebSocket service initialized');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      console.log(`✅ WebSocket client connected: ${socket.id}`);

      // Get user ID from auth (you'll need to implement auth)
      const userId = socket.handshake.auth.userId || socket.handshake.query.userId;

      if (userId) {
        // Join user-specific room
        socket.join(`user:${userId}`);
        console.log(`User ${userId} joined room`);
      }

      // Handle subscriptions
      socket.on('subscribe:rfp', (rfpId: string) => {
        socket.join(`rfp:${rfpId}`);
        console.log(`Socket ${socket.id} subscribed to RFP ${rfpId}`);
      });

      socket.on('subscribe:scan', (scanId: string) => {
        socket.join(`scan:${scanId}`);
        console.log(`Socket ${socket.id} subscribed to scan ${scanId}`);
      });

      socket.on('unsubscribe:rfp', (rfpId: string) => {
        socket.leave(`rfp:${rfpId}`);
      });

      socket.on('unsubscribe:scan', (scanId: string) => {
        socket.leave(`scan:${scanId}`);
      });

      socket.on('disconnect', (reason) => {
        console.log(`WebSocket client disconnected: ${socket.id} (${reason})`);
      });

      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  /**
   * Emit RFP discovered event to user
   */
  emitRFPDiscovered(userId: string, rfp: any): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit('rfp:discovered', {
      rfp,
      timestamp: new Date(),
    });
  }

  /**
   * Emit scan progress update
   */
  emitScanProgress(scanId: string, progress: number, message?: string): void {
    if (!this.io) return;
    this.io.to(`scan:${scanId}`).emit('scan:progress', {
      scanId,
      progress,
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Emit scan completed event
   */
  emitScanCompleted(scanId: string, result: any): void {
    if (!this.io) return;
    this.io.to(`scan:${scanId}`).emit('scan:completed', {
      scanId,
      result,
      timestamp: new Date(),
    });
  }

  /**
   * Emit proposal status update
   */
  emitProposalStatus(proposalId: string, status: string, data?: any): void {
    if (!this.io) return;
    this.io.to(`proposal:${proposalId}`).emit('proposal:status', {
      proposalId,
      status,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Emit agent status update
   */
  emitAgentStatus(agentId: string, status: string): void {
    if (!this.io) return;
    this.io.to('admin').emit('agent:status', {
      agentId,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.io?.sockets.sockets.size || 0;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    if (this.io) {
      this.io.close();
      this.initialized = false;
      console.log('WebSocket service shut down');
    }
  }
}

export const websocketService = new WebSocketService();
```

### Step 2.3: Update Server Initialization

The server index file has already been updated (as noted in the system reminder). The WebSocket service is initialized after Vite setup:

```typescript
// Initialize WebSocket server
websocketService.initialize(server);
log('🔌 WebSocket server initialized on /ws');

// ... existing code ...

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down gracefully');
  websocketService.shutdown();
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});
```

### Step 2.4: Emit Events from Backend

Update scan service to emit progress:

```typescript
// In /Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/services/scan-manager.ts
import { websocketService } from './websocketService';

async function executeScan(scanId: string, portalId: string) {
  // ... existing scan logic ...

  // Emit progress
  websocketService.emitScanProgress(scanId, 25, 'Authenticating...');

  // ... more scan logic ...

  websocketService.emitScanProgress(scanId, 50, 'Extracting data...');

  // ... more scan logic ...

  websocketService.emitScanProgress(scanId, 75, 'Parsing results...');

  // ... final steps ...

  websocketService.emitScanCompleted(scanId, results);
}
```

### Step 2.5: Frontend WebSocket Client

Update frontend to connect to WebSocket:

Create `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/client/src/lib/websocket.ts`:

```typescript
import { io, Socket } from 'socket.io-client';

class WebSocketClient {
  private socket: Socket | null = null;
  private connected = false;

  connect(userId?: string): void {
    if (this.connected) return;

    const wsUrl = import.meta.env.VITE_WS_URL || window.location.origin;

    this.socket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      auth: {
        userId,
      },
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.connected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  /**
   * Subscribe to RFP updates
   */
  subscribeToRFP(rfpId: string, callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.emit('subscribe:rfp', rfpId);
    this.socket.on('rfp:discovered', callback);
  }

  /**
   * Subscribe to scan progress
   */
  subscribeToScan(scanId: string, callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.emit('subscribe:scan', scanId);
    this.socket.on('scan:progress', callback);
    this.socket.on('scan:completed', callback);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const wsClient = new WebSocketClient();
```

### Step 2.6: Use in React Components

Example: Show real-time scan progress

```typescript
import { useEffect, useState } from 'react';
import { wsClient } from '@/lib/websocket';

export function ScanProgressComponent({ scanId }: { scanId: string }) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Connect WebSocket
    wsClient.connect();

    // Subscribe to scan updates
    wsClient.subscribeToScan(scanId, (data) => {
      if (data.progress !== undefined) {
        setProgress(data.progress);
        setMessage(data.message || '');
      }
    });

    return () => {
      // Cleanup
      wsClient.disconnect();
    };
  }, [scanId]);

  return (
    <div>
      <div className="progress-bar">
        <div style={{ width: `${progress}%` }} />
      </div>
      <p>{message}</p>
    </div>
  );
}
```

---

## Week 2: BullMQ Task Queue

### Step 3.1: Install Dependencies

```bash
pnpm add bullmq
```

### Step 3.2: Create Queue Service

Create `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/services/queueService.ts`:

```typescript
import { Queue, Worker, QueueScheduler, Job } from 'bullmq';
import { redisClient } from './redisClient';

// Define task types
export type TaskType =
  | 'portal-scan'
  | 'proposal-generation'
  | 'document-processing'
  | 'compliance-check'
  | 'notification';

// Priority levels
export enum Priority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  URGENT = 10,
}

class QueueService {
  private queues: Map<TaskType, Queue> = new Map();
  private workers: Map<TaskType, Worker> = new Map();
  private schedulers: Map<TaskType, QueueScheduler> = new Map();

  constructor() {
    this.initializeQueues();
  }

  private initializeQueues(): void {
    const taskTypes: TaskType[] = [
      'portal-scan',
      'proposal-generation',
      'document-processing',
      'compliance-check',
      'notification',
    ];

    for (const taskType of taskTypes) {
      const queue = new Queue(taskType, {
        connection: redisClient,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000, // 2s, 4s, 8s, 16s, 32s
          },
          removeOnComplete: {
            age: 3600, // Keep for 1 hour
            count: 1000,
          },
          removeOnFail: {
            age: 86400, // Keep for 24 hours
          },
        },
      });

      this.queues.set(taskType, queue);

      // Create scheduler for delayed jobs
      const scheduler = new QueueScheduler(taskType, {
        connection: redisClient,
      });
      this.schedulers.set(taskType, scheduler);

      console.log(`✅ Queue initialized: ${taskType}`);
    }
  }

  /**
   * Add job to queue
   */
  async addJob(
    taskType: TaskType,
    data: any,
    options?: {
      priority?: Priority;
      delay?: number;
      jobId?: string;
    }
  ): Promise<Job> {
    const queue = this.queues.get(taskType);
    if (!queue) {
      throw new Error(`Queue not found: ${taskType}`);
    }

    const job = await queue.add(taskType, data, {
      priority: options?.priority || Priority.NORMAL,
      delay: options?.delay,
      jobId: options?.jobId,
    });

    console.log(`📤 Job added to ${taskType} queue: ${job.id}`);
    return job;
  }

  /**
   * Get job status
   */
  async getJobStatus(taskType: TaskType, jobId: string): Promise<any> {
    const queue = this.queues.get(taskType);
    if (!queue) return null;

    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress;

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  }

  /**
   * Register worker for a task type
   */
  registerWorker(
    taskType: TaskType,
    processor: (job: Job) => Promise<any>,
    concurrency: number = 5
  ): void {
    const worker = new Worker(taskType, processor, {
      connection: redisClient,
      concurrency,
      limiter: {
        max: 100, // Max 100 jobs per...
        duration: 60000, // ...60 seconds
      },
    });

    worker.on('completed', (job) => {
      console.log(`✅ Job completed: ${taskType} - ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Job failed: ${taskType} - ${job?.id}`, err.message);
    });

    worker.on('error', (err) => {
      console.error(`Worker error: ${taskType}`, err);
    });

    this.workers.set(taskType, worker);
    console.log(`✅ Worker registered: ${taskType} (concurrency: ${concurrency})`);
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(taskType: TaskType): Promise<any> {
    const queue = this.queues.get(taskType);
    if (!queue) return null;

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      taskType,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Shutdown all queues and workers
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down queue service...');

    for (const worker of this.workers.values()) {
      await worker.close();
    }

    for (const scheduler of this.schedulers.values()) {
      await scheduler.close();
    }

    for (const queue of this.queues.values()) {
      await queue.close();
    }

    console.log('Queue service shut down');
  }
}

export const queueService = new QueueService();
```

### Step 3.3: Register Workers

Create `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/workers/index.ts`:

```typescript
import { queueService } from '../services/queueService';
import { Job } from 'bullmq';

// Portal scan worker
queueService.registerWorker(
  'portal-scan',
  async (job: Job) => {
    const { portalId, searchFilter } = job.data;

    console.log(`Processing portal scan: ${portalId}`);

    // Update progress
    await job.updateProgress(10);

    // Execute scan (your existing logic)
    const result = await executeScan(portalId, searchFilter);

    await job.updateProgress(100);

    return result;
  },
  10 // Concurrency: process 10 scans concurrently
);

// Proposal generation worker
queueService.registerWorker(
  'proposal-generation',
  async (job: Job) => {
    const { rfpId, companyProfileId } = job.data;

    console.log(`Generating proposal for RFP: ${rfpId}`);

    await job.updateProgress(20);

    // Your proposal generation logic
    const proposal = await generateProposal(rfpId, companyProfileId);

    await job.updateProgress(100);

    return proposal;
  },
  5 // Concurrency: 5 proposals at a time
);

console.log('✅ Workers registered');
```

### Step 3.4: Use Queue in Routes

Update routes to use queue instead of direct execution:

```typescript
// In portal scan route
import { queueService, Priority } from '../services/queueService';

app.post('/api/portals/:id/scan', async (req, res) => {
  const { id } = req.params;
  const { searchFilter } = req.body;

  try {
    // Add job to queue instead of executing directly
    const job = await queueService.addJob(
      'portal-scan',
      {
        portalId: id,
        searchFilter,
      },
      {
        priority: Priority.HIGH,
      }
    );

    res.json({
      success: true,
      jobId: job.id,
      message: 'Scan queued successfully',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue scan' });
  }
});

// Check job status
app.get('/api/jobs/:taskType/:jobId', async (req, res) => {
  const { taskType, jobId } = req.params;

  const status = await queueService.getJobStatus(taskType as any, jobId);

  if (!status) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(status);
});
```

### Step 3.5: Queue Monitoring Endpoint

Add monitoring endpoint:

```typescript
app.get('/api/queue/metrics', async (req, res) => {
  const metrics = await Promise.all([
    queueService.getQueueMetrics('portal-scan'),
    queueService.getQueueMetrics('proposal-generation'),
    queueService.getQueueMetrics('document-processing'),
    queueService.getQueueMetrics('compliance-check'),
    queueService.getQueueMetrics('notification'),
  ]);

  res.json({
    queues: metrics,
    timestamp: new Date(),
  });
});
```

---

## Testing & Verification

### Test Redis Connection

```bash
# Test Redis connection
node -e "const Redis = require('ioredis'); const redis = new Redis(process.env.REDIS_HOST); redis.ping().then(() => console.log('Redis OK')).catch(console.error);"
```

### Test WebSocket

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c "ws://localhost:3000/ws"

# Should see: connected
```

### Test BullMQ

```bash
# Run workers
npm run dev

# In another terminal, trigger a job
curl -X POST http://localhost:3000/api/portals/test-portal-id/scan \
  -H "Content-Type: application/json" \
  -d '{"searchFilter": "technology"}'

# Check job status
curl http://localhost:3000/api/jobs/portal-scan/JOB_ID_FROM_RESPONSE
```

---

## Monitoring

### Redis Metrics

```bash
# Connect to Redis CLI
redis-cli -h YOUR_REDIS_HOST -p 6379

# Check info
INFO stats
INFO keyspace

# Check connection count
CLIENT LIST
```

### WebSocket Connections

```bash
# Check connection count
curl http://localhost:3000/api/ws/connections
```

### Queue Metrics

```bash
# Check queue depth
curl http://localhost:3000/api/queue/metrics
```

---

## Troubleshooting

### Redis Connection Issues

**Problem:** Cannot connect to Redis
**Solution:**
1. Check Redis host/port in `.env`
2. Verify security group allows port 6379
3. Check Redis password (if using auth)

### WebSocket Not Connecting

**Problem:** WebSocket fails to connect
**Solution:**
1. Check CORS settings in Socket.io
2. Verify `/ws` path is not blocked by proxy
3. Check client is using correct URL

### Queue Jobs Not Processing

**Problem:** Jobs stuck in queue
**Solution:**
1. Verify workers are registered (check logs)
2. Check Redis connection
3. Increase worker concurrency if needed

---

## Next Steps

After completing Week 1-2:

1. **Add PostgreSQL read replicas** (Week 3)
2. **Set up monitoring** (Week 3)
3. **Begin Kubernetes setup** (Week 4+)

---

## Support

**Questions?**
- Engineering Lead: engineering@rfpagent.com
- DevOps: devops@rfpagent.com

**Resources:**
- Redis Documentation: https://redis.io/docs
- Socket.io Documentation: https://socket.io/docs
- BullMQ Documentation: https://docs.bullmq.io

---

**End of Quick Start Guide**

*Last Updated: 2025-10-02*
*Next Update: After Week 2 completion*
