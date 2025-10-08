import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  useWebSocket,
  type WebSocketMessage,
  type WebSocketStatus,
} from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

interface RealtimeContextValue {
  status: WebSocketStatus;
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: any) => boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(
  undefined
);

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
}

interface RealtimeProviderProps {
  children: React.ReactNode;
  showConnectionStatus?: boolean;
}

export function RealtimeProvider({
  children,
  showConnectionStatus = true,
}: RealtimeProviderProps) {
  const { toast } = useToast();
  const [hasShownDisconnectToast, setHasShownDisconnectToast] = useState(false);
  const [hasShownConnectToast, setHasShownConnectToast] = useState(false);

  const { status, lastMessage, isConnected, sendMessage } = useWebSocket({
    onConnect: () => {
      console.log('[Realtime] Connected to server');
      if (hasShownDisconnectToast && !hasShownConnectToast) {
        toast({
          title: 'Connection Restored',
          description: 'Real-time updates are now active',
          duration: 3000,
        });
        setHasShownConnectToast(true);
        setHasShownDisconnectToast(false);
      }
    },
    onDisconnect: () => {
      console.log('[Realtime] Disconnected from server');
      if (!hasShownDisconnectToast) {
        toast({
          title: 'Connection Lost',
          description: 'Attempting to reconnect...',
          variant: 'destructive',
          duration: 5000,
        });
        setHasShownDisconnectToast(true);
        setHasShownConnectToast(false);
      }
    },
    onMessage: message => {
      // Show toast for important real-time events
      switch (message.type) {
        case 'rfp:new':
          toast({
            title: 'New RFP Discovered',
            description: message.payload.title || 'A new RFP has been found',
            duration: 5000,
          });
          break;
        case 'proposal:generated':
          toast({
            title: 'Proposal Generated',
            description: 'A new proposal has been generated successfully',
            duration: 5000,
          });
          break;
        case 'portal:scan:complete':
          toast({
            title: 'Portal Scan Complete',
            description: `Found ${message.payload.count || 0} new opportunities`,
            duration: 5000,
          });
          break;
        case 'workflow:error':
          toast({
            title: 'Workflow Error',
            description: message.payload.error || 'An error occurred',
            variant: 'destructive',
            duration: 7000,
          });
          break;
      }
    },
    autoInvalidateQueries: true,
    reconnectAttempts: 5,
    reconnectInterval: 3000,
  });

  const value: RealtimeContextValue = {
    status,
    isConnected,
    lastMessage,
    sendMessage,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {showConnectionStatus && <ConnectionStatusIndicator status={status} />}
      {children}
    </RealtimeContext.Provider>
  );
}

function ConnectionStatusIndicator({ status }: { status: WebSocketStatus }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Live',
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600',
        };
      case 'connecting':
        return {
          icon: Wifi,
          text: 'Connecting',
          variant: 'secondary' as const,
          className: 'bg-yellow-500 hover:bg-yellow-600 animate-pulse',
        };
      case 'disconnected':
      case 'error':
        return {
          icon: WifiOff,
          text: 'Offline',
          variant: 'destructive' as const,
          className: 'bg-red-500 hover:bg-red-600',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
      <Badge
        variant={config.variant}
        className={`${config.className} text-white px-3 py-1.5`}
      >
        <Icon className="h-3 w-3 mr-1.5" />
        {config.text}
      </Badge>
    </div>
  );
}

export function LiveIndicator() {
  const { isConnected } = useRealtime();

  if (!isConnected) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span className="text-xs font-medium text-green-600">Live</span>
    </div>
  );
}
