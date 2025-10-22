import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScanStep {
  step:
    | 'initializing'
    | 'authenticating'
    | 'authenticated'
    | 'navigating'
    | 'extracting'
    | 'parsing'
    | 'saving'
    | 'completed'
    | 'failed';
  progress: number;
  message: string;
  timestamp: Date;
}

export interface ScanEvent {
  type:
    | 'scan_started'
    | 'step_update'
    | 'log'
    | 'progress'
    | 'rfp_discovered'
    | 'error'
    | 'scan_completed'
    | 'scan_failed';
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
  const timeoutIdsRef = useRef<number[]>([]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    currentScanIdRef.current = null;
  }, []);

  const connectToScan = useCallback(
    (scanId: string, targetPortalId: string) => {
      // Disconnect any existing connection
      disconnect();

      const url = new URL(
        `/api/portals/${encodeURIComponent(targetPortalId)}/scan/stream`,
        window.location.origin
      );
      url.searchParams.set('scanId', scanId);
      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;
      currentScanIdRef.current = scanId;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onerror = err => {
        console.error('SSE connection error:', err);
        setIsConnected(false);

        // Provide more specific error context
        const readyState = eventSource.readyState;
        let errorMessage = 'Connection lost.';

        if (readyState === EventSource.CLOSED) {
          errorMessage =
            'Connection closed by server. The scan may have completed or failed.';
        } else if (readyState === EventSource.CONNECTING) {
          errorMessage = 'Attempting to reconnect...';
        }

        setError(errorMessage);
      };

      eventSource.onmessage = event => {
        try {
          const scanEvent: ScanEvent = JSON.parse(event.data);

          setScanState(prevState => {
            if (!prevState) {
              // Initialize scan state with safe timestamp parsing
              const timestamp = scanEvent.timestamp
                ? new Date(scanEvent.timestamp)
                : new Date();
              const isValidTimestamp = !isNaN(timestamp.getTime());

              return {
                scanId,
                portalId: targetPortalId,
                portalName: '', // Will be updated from events
                status: 'running',
                currentStep: {
                  step: 'initializing',
                  progress: 0,
                  message: 'Starting scan...',
                  timestamp: isValidTimestamp ? timestamp : new Date(),
                },
                events: [scanEvent],
                rfpsDiscovered: [],
                startedAt: isValidTimestamp ? timestamp : new Date(),
              };
            }

            const newState = { ...prevState };
            newState.events = [...newState.events, scanEvent];

            // Update state based on event type
            switch (scanEvent.type) {
              case 'initial_state':
                // Backend sends full scan state when SSE connection is established
                if (scanEvent.data) {
                  const timestamp = scanEvent.data.startedAt
                    ? new Date(scanEvent.data.startedAt)
                    : new Date();
                  const isValidTimestamp = !isNaN(timestamp.getTime());

                  newState.portalName =
                    scanEvent.data.portalName || newState.portalName;
                  newState.status = scanEvent.data.status || 'running';
                  newState.startedAt = isValidTimestamp ? timestamp : new Date();

                  if (scanEvent.data.currentStep) {
                    const stepTimestamp = scanEvent.data.currentStep.timestamp
                      ? new Date(scanEvent.data.currentStep.timestamp)
                      : timestamp;
                    newState.currentStep = {
                      step: scanEvent.data.currentStep.step || 'initializing',
                      progress: scanEvent.data.currentStep.progress || 0,
                      message: scanEvent.data.currentStep.message || 'Starting...',
                      timestamp: !isNaN(stepTimestamp.getTime()) ? stepTimestamp : new Date(),
                    };
                  }

                  if (scanEvent.data.discoveredRFPs) {
                    newState.rfpsDiscovered = scanEvent.data.discoveredRFPs;
                  }
                }
                break;

              case 'scan_started':
                newState.status = 'running';
                newState.portalName =
                  scanEvent.data?.portalName || newState.portalName;
                break;

              case 'step_update':
                // Validate scanEvent.data is an object with expected fields
                // Note: Backend sends message at top level, not in data
                if (
                  typeof scanEvent.data === 'object' &&
                  scanEvent.data !== null &&
                  typeof scanEvent.data.step === 'string' &&
                  typeof scanEvent.data.progress === 'number'
                ) {
                  // Safe timestamp parsing
                  const timestamp = scanEvent.timestamp
                    ? new Date(scanEvent.timestamp)
                    : new Date();
                  const isValidTimestamp = !isNaN(timestamp.getTime());

                  newState.currentStep = {
                    step: scanEvent.data.step,
                    progress: scanEvent.data.progress,
                    // Message can be in data OR at top level (backend sends at top level)
                    message:
                      scanEvent.data.message ||
                      (scanEvent as any).message ||
                      'Processing...',
                    timestamp: isValidTimestamp ? timestamp : new Date(),
                  };
                } else {
                  // Log malformed event and skip update
                  console.warn('Malformed step_update event:', scanEvent);
                }
                break;

              case 'rfp_discovered':
                newState.rfpsDiscovered = [
                  ...newState.rfpsDiscovered,
                  scanEvent.data,
                ];
                break;

              case 'scan_completed': {
                newState.status = 'completed';
                // Safe timestamp parsing
                const completedTimestamp = scanEvent.timestamp
                  ? new Date(scanEvent.timestamp)
                  : new Date();
                newState.completedAt = !isNaN(completedTimestamp.getTime())
                  ? completedTimestamp
                  : new Date();
                newState.currentStep = {
                  ...newState.currentStep,
                  progress: 100,
                  message: 'Scan completed successfully',
                };
                // Auto-disconnect after completion
                timeoutIdsRef.current.push(window.setTimeout(disconnect, 1000));
                break;
              }

              case 'scan_failed': {
                newState.status = 'failed';
                // Safe timestamp parsing
                const failedTimestamp = scanEvent.timestamp
                  ? new Date(scanEvent.timestamp)
                  : new Date();
                newState.completedAt = !isNaN(failedTimestamp.getTime())
                  ? failedTimestamp
                  : new Date();
                newState.error = scanEvent.data?.error || 'Scan failed';
                newState.currentStep = {
                  ...newState.currentStep,
                  message: `Scan failed: ${newState.error}`,
                };
                // Auto-disconnect after failure
                timeoutIdsRef.current.push(window.setTimeout(disconnect, 1000));
                break;
              }

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
    },
    [disconnect]
  );

  const startScan = useCallback(
    async (targetPortalId: string): Promise<string | null> => {
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
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to start scan';
        setError(errorMessage);
        return null;
      }
    },
    [connectToScan]
  );

  const reconnect = useCallback(() => {
    if (currentScanIdRef.current && portalId) {
      connectToScan(currentScanIdRef.current, portalId);
    }
  }, [connectToScan, portalId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts
      timeoutIdsRef.current.forEach(id => clearTimeout(id));
      timeoutIdsRef.current = [];
      disconnect();
    };
  }, [disconnect]);

  return {
    scanState,
    isConnected,
    error,
    startScan,
    disconnect,
    reconnect,
  };
}
