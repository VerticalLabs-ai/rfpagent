import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from '../../utils/logger';

/**
 * WebSocket Service for Real-Time Updates
 * Provides bi-directional communication for live updates
 */

export type WebSocketMessageType =
  | 'rfp:discovered'
  | 'rfp:updated'
  | 'proposal:generated'
  | 'proposal:updated'
  | 'agent:activity'
  | 'workflow:progress'
  | 'scan:started'
  | 'scan:completed'
  | 'notification'
  | 'health:update'
  | 'ping'
  | 'pong';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
  timestamp: string;
  correlationId?: string;
}

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
  metadata?: Record<string, any>;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PING_TIMEOUT = 10000; // 10 seconds

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start ping interval
    this.startPingInterval();

    logger.info('WebSocket server initialized', {
      path: '/ws',
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      lastPing: Date.now(),
    };

    this.clients.set(clientId, client);

    logger.info('WebSocket client connected', {
      clientId,
      totalClients: this.clients.size,
      ip: req.socket.remoteAddress,
    });

    // Don't send welcome message immediately - let client settle first
    // setTimeout(() => {
    //   if (client.ws.readyState === WebSocket.OPEN) {
    //     this.sendToClient(client, {
    //       type: 'notification',
    //       payload: {
    //         message: 'Connected to RFP Agent WebSocket',
    //         clientId,
    //       },
    //       timestamp: new Date().toISOString(),
    //     });
    //   }
    // }, 100);

    // Handle messages from client
    ws.on('message', data => {
      this.handleMessage(client, data);
    });

    // Handle client disconnect
    ws.on('close', (code, reason) => {
      logger.info('WebSocket client close event', {
        clientId,
        code,
        reason: reason.toString(),
      });
      this.handleDisconnect(clientId);
    });

    // Handle errors
    ws.on('error', error => {
      logger.error('WebSocket connection error', error, {
        clientId,
        message: error.message,
        stack: error.stack,
      });
    });

    // Handle pong responses
    ws.on('pong', () => {
      client.lastPing = Date.now();
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(client: WebSocketClient, data: any): void {
    try {
      const message = JSON.parse(data.toString());

      logger.debug('WebSocket message received', {
        clientId: client.id,
        type: message.type,
      });

      // Handle different message types
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(client, message.payload);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(client, message.payload);
          break;
        case 'ping':
          this.sendToClient(client, {
            type: 'pong',
            payload: {},
            timestamp: new Date().toISOString(),
          });
          break;
        default:
          logger.warn('Unknown WebSocket message type', {
            clientId: client.id,
            type: message.type,
          });
      }
    } catch (error) {
      logger.error(
        'Error handling WebSocket message',
        error instanceof Error ? error : new Error(String(error)),
        {
          clientId: client.id,
        }
      );
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(client: WebSocketClient, payload: any): void {
    const { channels } = payload;

    if (Array.isArray(channels)) {
      channels.forEach(channel => client.subscriptions.add(channel));
      logger.info('Client subscribed to channels', {
        clientId: client.id,
        channels,
      });

      this.sendToClient(client, {
        type: 'notification',
        payload: {
          message: 'Subscribed successfully',
          channels,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle unsubscription request
   */
  private handleUnsubscribe(client: WebSocketClient, payload: any): void {
    const { channels } = payload;

    if (Array.isArray(channels)) {
      channels.forEach(channel => client.subscriptions.delete(channel));
      logger.info('Client unsubscribed from channels', {
        clientId: client.id,
        channels,
      });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    logger.info('WebSocket client disconnected', {
      clientId,
      remainingClients: this.clients.size,
    });
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);

    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    }

    logger.debug('Message broadcasted', {
      type: message.type,
      clientCount: this.clients.size,
    });
  }

  /**
   * Send message to specific channel subscribers
   */
  broadcastToChannel(channel: string, message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const client of this.clients.values()) {
      if (
        client.subscriptions.has(channel) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(messageStr);
        sentCount++;
      }
    }

    logger.debug('Message broadcasted to channel', {
      channel,
      type: message.type,
      clientCount: sentCount,
    });
  }

  /**
   * Send message to specific client
   */
  sendToClient(client: WebSocketClient, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send RFP discovery notification
   */
  notifyRfpDiscovered(rfpData: any): void {
    this.broadcastToChannel('rfps', {
      type: 'rfp:discovered',
      payload: rfpData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send proposal generation notification
   */
  notifyProposalGenerated(proposalData: any): void {
    this.broadcastToChannel('proposals', {
      type: 'proposal:generated',
      payload: proposalData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send workflow progress update
   */
  notifyWorkflowProgress(workflowData: any): void {
    this.broadcastToChannel('workflows', {
      type: 'workflow:progress',
      payload: workflowData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send agent activity notification
   */
  notifyAgentActivity(activityData: any): void {
    this.broadcastToChannel('agents', {
      type: 'agent:activity',
      payload: activityData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send scan notification
   */
  notifyScanEvent(event: 'started' | 'completed', scanData: any): void {
    this.broadcastToChannel('scans', {
      type: event === 'started' ? 'scan:started' : 'scan:completed',
      payload: scanData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      // Give clients PING_INTERVAL + PING_TIMEOUT to respond before closing
      const timeout = this.PING_INTERVAL + this.PING_TIMEOUT;

      for (const client of this.clients.values()) {
        // Check if client is responsive
        if (now - client.lastPing > timeout) {
          logger.warn('Client ping timeout, closing connection', {
            clientId: client.id,
            lastPing: new Date(client.lastPing).toISOString(),
          });
          client.ws.terminate();
          this.clients.delete(client.id);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          // Send ping
          client.ws.ping();
        }
      }
    }, this.PING_INTERVAL);

    logger.debug('WebSocket ping interval started', {
      interval: this.PING_INTERVAL,
    });
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    subscriptionCounts: Record<string, number>;
  } {
    const subscriptionCounts: Record<string, number> = {};

    for (const client of this.clients.values()) {
      for (const sub of client.subscriptions) {
        subscriptionCounts[sub] = (subscriptionCounts[sub] || 0) + 1;
      }
    }

    return {
      totalConnections: this.clients.size,
      activeConnections: Array.from(this.clients.values()).filter(
        c => c.ws.readyState === WebSocket.OPEN
      ).length,
      subscriptionCounts,
    };
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    for (const client of this.clients.values()) {
      client.ws.close(1000, 'Server shutting down');
    }

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shutdown');
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
