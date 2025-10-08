import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type WebSocketMessage = {
  type: string;
  payload: any;
  timestamp: number;
};

export type WebSocketStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoInvalidateQueries?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onError,
    onConnect,
    onDisconnect,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    autoInvalidateQueries = true,
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isConnectingRef = useRef(false);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      isConnectingRef.current
    ) {
      return;
    }

    isConnectingRef.current = true;
    setStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setStatus('connected');
        reconnectCountRef.current = 0;
        isConnectingRef.current = false;
        onConnect?.();
      };

      ws.onmessage = event => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);

          // Auto-invalidate queries based on message type
          if (autoInvalidateQueries) {
            switch (message.type) {
              case 'rfp:new':
              case 'rfp:updated':
                queryClient.invalidateQueries({ queryKey: ['/api/rfps'] });
                queryClient.invalidateQueries({
                  queryKey: ['/api/dashboard/metrics'],
                });
                break;
              case 'portal:scan:complete':
              case 'portal:updated':
                queryClient.invalidateQueries({ queryKey: ['/api/portals'] });
                break;
              case 'proposal:generated':
              case 'proposal:updated':
                queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
                break;
              case 'agent:status':
                queryClient.invalidateQueries({
                  queryKey: ['/api/agent-performance'],
                });
                queryClient.invalidateQueries({
                  queryKey: ['/api/system-health'],
                });
                break;
              case 'workflow:progress':
                queryClient.invalidateQueries({
                  queryKey: ['/api/workflows/state'],
                });
                break;
            }
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = error => {
        console.error('[WebSocket] Error:', error);
        setStatus('error');
        isConnectingRef.current = false;
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setStatus('disconnected');
        isConnectingRef.current = false;
        onDisconnect?.();

        // Attempt to reconnect with exponential backoff
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          // Exponential backoff: 3s, 6s, 12s, 24s, 48s
          const backoffDelay =
            reconnectInterval * Math.pow(2, reconnectCountRef.current - 1);
          console.log(
            `[WebSocket] Reconnecting in ${backoffDelay}ms (${reconnectCountRef.current}/${reconnectAttempts})...`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffDelay);
        } else {
          console.log('[WebSocket] Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      setStatus('error');
      isConnectingRef.current = false;
    }
  }, [
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    reconnectAttempts,
    reconnectInterval,
    autoInvalidateQueries,
    queryClient,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('[WebSocket] Cannot send message - not connected');
    return false;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only connect on mount, disconnect on unmount

  return {
    status,
    lastMessage,
    isConnected: status === 'connected',
    connect,
    disconnect,
    sendMessage,
  };
}
