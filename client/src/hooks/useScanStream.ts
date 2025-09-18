import { useState, useEffect, useRef, useCallback } from 'react';

export interface ScanStep {
  step: 'initializing' | 'authenticating' | 'authenticated' | 'navigating' | 'extracting' | 'parsing' | 'saving' | 'completed' | 'failed';
  progress: number;
  message: string;
  timestamp: Date;
}

export interface ScanEvent {
  type: 'scan_started' | 'step_update' | 'log' | 'progress' | 'rfp_discovered' | 'error' | 'scan_completed' | 'scan_failed';
  timestamp: Date;
  data?: any;
}

export interface ScanState {
  scanId: string;
  portalId: string;
  portalName: string;
  status: 'running' | 'completed' | 'failed';
  currentStep: ScanStep;
  events: ScanEvent[];
  rfpsDiscovered: any[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface UseScanStreamResult {
  scanState: ScanState | null;
  isConnected: boolean;
  error: string | null;
  startScan: (portalId: string) => Promise<string | null>;
  disconnect: () => void;
  reconnect: () => void;
}

export function useScanStream(portalId?: string): UseScanStreamResult {
  const [scanState, setScanState] = useState<ScanState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentScanIdRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    currentScanIdRef.current = null;
  }, []);

  const connectToScan = useCallback((scanId: string, targetPortalId: string) => {
    // Disconnect any existing connection
    disconnect();

    const eventSource = new EventSource(`/api/portals/${targetPortalId}/scan/stream?scanId=${scanId}`);
    eventSourceRef.current = eventSource;
    currentScanIdRef.current = scanId;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost. Attempting to reconnect...');
    };

    eventSource.onmessage = (event) => {
      try {
        const scanEvent: ScanEvent = JSON.parse(event.data);
        
        setScanState(prevState => {
          if (!prevState) {
            // Initialize scan state
            return {
              scanId,
              portalId: targetPortalId,
              portalName: '', // Will be updated from events
              status: 'running',
              currentStep: {
                step: 'initializing',
                progress: 0,
                message: 'Starting scan...',
                timestamp: new Date(scanEvent.timestamp)
              },
              events: [scanEvent],
              rfpsDiscovered: [],
              startedAt: new Date(scanEvent.timestamp)
            };
          }

          const newState = { ...prevState };
          newState.events = [...newState.events, scanEvent];

          // Update state based on event type
          switch (scanEvent.type) {
            case 'scan_started':
              newState.status = 'running';
              newState.portalName = scanEvent.data?.portalName || newState.portalName;
              break;

            case 'step_update':
              newState.currentStep = {
                step: scanEvent.data.step,
                progress: scanEvent.data.progress,
                message: scanEvent.data.message,
                timestamp: new Date(scanEvent.timestamp)
              };
              break;

            case 'rfp_discovered':
              newState.rfpsDiscovered = [...newState.rfpsDiscovered, scanEvent.data];
              break;

            case 'scan_completed':
              newState.status = 'completed';
              newState.completedAt = new Date(scanEvent.timestamp);
              newState.currentStep = {
                ...newState.currentStep,
                progress: 100,
                message: 'Scan completed successfully'
              };
              // Auto-disconnect after completion
              setTimeout(disconnect, 1000);
              break;

            case 'scan_failed':
              newState.status = 'failed';
              newState.completedAt = new Date(scanEvent.timestamp);
              newState.error = scanEvent.data?.error || 'Scan failed';
              newState.currentStep = {
                ...newState.currentStep,
                message: `Scan failed: ${newState.error}`
              };
              // Auto-disconnect after failure
              setTimeout(disconnect, 1000);
              break;

            case 'error':
              newState.error = scanEvent.data?.message || 'An error occurred';
              break;
          }

          return newState;
        });
      } catch (err) {
        console.error('Failed to parse scan event:', err);
        setError('Failed to parse scan data');
      }
    };
  }, [disconnect]);

  const startScan = useCallback(async (targetPortalId: string): Promise<string | null> => {
    try {
      setError(null);
      
      const response = await fetch(`/api/portals/${targetPortalId}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start scan');
      }

      const { scanId } = await response.json();
      
      // Connect to the scan stream
      connectToScan(scanId, targetPortalId);
      
      return scanId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start scan';
      setError(errorMessage);
      return null;
    }
  }, [connectToScan]);

  const reconnect = useCallback(() => {
    if (currentScanIdRef.current && portalId) {
      connectToScan(currentScanIdRef.current, portalId);
    }
  }, [connectToScan, portalId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    scanState,
    isConnected,
    error,
    startScan,
    disconnect,
    reconnect
  };
}