import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ProgressStep {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message: string;
  details?: any;
  timestamp: Date;
}

interface RFPProcessingProgress {
  rfpId?: string;
  url: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  status: 'initializing' | 'processing' | 'completed' | 'failed';
  steps: ProgressStep[];
  error?: string;
}

interface RFPProcessingProgressProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (rfpId: string) => void;
  onError?: (error: string) => void;
  endpoint?: string; // Custom SSE endpoint, defaults to RFP manual processing
}

export function RFPProcessingProgressModal({
  sessionId,
  open,
  onOpenChange,
  onComplete,
  onError,
  endpoint,
}: RFPProcessingProgressProps) {
  const [progress, setProgress] = useState<RFPProcessingProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  useEffect(() => {
    if (!open || !sessionId) return;

    console.log(`📡 Connecting to progress stream for session: ${sessionId}`);

    let eventSource: EventSource | null = null;
    let isCleaningUp = false;
    let reconnectTimer: NodeJS.Timeout | null = null;
    const BASE_RECONNECT_DELAY_MS = 1000;
    const sseEndpoint = endpoint || `/api/rfps/manual/progress/${sessionId}`;

    const getReconnectDelay = (attempt: number, serverSuggestedDelay?: number): number => {
      if (serverSuggestedDelay) return serverSuggestedDelay;
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped)
      return Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt), 16000);
    };

    const connectToStream = () => {
      if (isCleaningUp || eventSource?.readyState === EventSource.OPEN) return;

      setAttemptCount(currentAttempt => {
        if (currentAttempt >= MAX_RECONNECT_ATTEMPTS) {
          console.log(`📡 Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
          setConnectionError(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Please refresh the page.`);
          return currentAttempt;
        }
        return currentAttempt;
      });

      // Close existing connection if any
      if (eventSource) {
        eventSource.close();
      }

      try {
        setAttemptCount(currentAttempt => {
          console.log(`📡 Connection attempt ${currentAttempt + 1}/${MAX_RECONNECT_ATTEMPTS}`);
          return currentAttempt;
        });
        eventSource = new EventSource(sseEndpoint);

        eventSource.onopen = () => {
          console.log('📡 SSE connection opened');
          setIsConnected(true);
          setConnectionError(null);
          setAttemptCount(0); // Reset on successful connection
        };

        eventSource.onmessage = event => {
          if (isCleaningUp) return;

          try {
            const data = JSON.parse(event.data);
            console.log('📡 Received SSE message:', data);

            switch (data.type) {
              case 'connected':
                console.log('📡 SSE connected to session');
                break;

              case 'progress':
                console.log(
                  '📡 Progress update received:',
                  data.data?.status,
                  data.data?.currentStep
                );
                setProgress(data.data);
                break;

              case 'complete':
                console.log('📡 Processing completed');
                if (onComplete && data.rfpId) {
                  onComplete(data.rfpId);
                }
                break;

              case 'error':
                console.error('📡 Processing error:', data.error);
                if (onError) {
                  onError(data.error);
                }
                break;

              case 'heartbeat':
                // Heartbeat received - connection is alive
                break;

              case 'shutdown':
                console.log('📡 Server shutdown notification received');
                setIsConnected(false);
                eventSource?.close();
                // Use server-suggested delay or default
                const delay = data.reconnectAfter || 5000;
                console.log(`📡 Will reconnect after ${delay}ms (server maintenance)`);
                reconnectTimer = setTimeout(() => {
                  if (!isCleaningUp) {
                    setAttemptCount(0); // Reset attempts for planned shutdown
                    connectToStream();
                  }
                }, delay);
                break;

              default:
                console.log('📡 Unknown message type:', data.type);
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        eventSource.onerror = error => {
          console.error('📡 SSE connection error:', error);
          setIsConnected(false);

          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
          }

          if (
            !isCleaningUp &&
            (!eventSource || eventSource.readyState === EventSource.CLOSED)
          ) {
            setAttemptCount(currentAttempt => {
              const newAttempt = currentAttempt + 1;
              const delay = getReconnectDelay(currentAttempt);
              console.log(`📡 Connection closed, retry ${newAttempt}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
              reconnectTimer = setTimeout(() => {
                if (!isCleaningUp) {
                  connectToStream();
                }
              }, delay);
              return newAttempt;
            });
          }
        };
      } catch (error) {
        console.error('📡 Failed to create EventSource:', error);
        setIsConnected(false);
        setAttemptCount(currentAttempt => currentAttempt + 1);
      }
    };

    // Add a small delay to ensure backend processing has started
    const connectionDelay = setTimeout(() => {
      connectToStream();
    }, 500);

    // Cleanup function
    return () => {
      isCleaningUp = true;
      clearTimeout(connectionDelay);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (eventSource) {
        console.log('📡 Closing SSE connection');
        eventSource.close();
        setIsConnected(false);
      }
    };
  }, [sessionId, open, onComplete, onError, endpoint, retryTrigger, MAX_RECONNECT_ATTEMPTS]);

  const getStepIcon = (status: ProgressStep['status']) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '◯';
      case 'failed':
        return '✗';
      default:
        return '○';
    }
  };

  const progressPercentage = progress
    ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            🔄 Processing RFP
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection Status - only show when connected and progress exists */}
          {isConnected && progress && (
            <Card>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-muted-foreground">
                      Connected to progress stream
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {progress && (
            <>
              {/* Overall Progress */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Overall Progress</CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {progress.completedSteps}/{progress.totalSteps} steps
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={progressPercentage} className="w-full" />
                  <p className="text-sm text-muted-foreground">
                    {progress.currentStep}
                  </p>
                </CardContent>
              </Card>

              {/* Processing Details */}
              <Card>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        progress.status === 'completed'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {progress.status}
                    </Badge>
                    {progress.rfpId && (
                      <Badge variant="outline">
                        ID: {progress.rfpId.substring(0, 8)}...
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">
                      Processing URL:
                    </p>
                    <p className="text-sm text-muted-foreground break-all">
                      {progress.url}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Step Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Processing Steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {progress.steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-md border bg-card transition-all"
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                          step.status === 'completed'
                            ? 'bg-green-500 text-white'
                            : step.status === 'in_progress'
                              ? 'bg-blue-500 text-white'
                              : step.status === 'failed'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {getStepIcon(step.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-sm text-foreground">
                            {step.step}
                          </h5>
                          <Badge
                            variant={
                              step.status === 'completed'
                                ? 'default'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {step.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {step.message}
                        </p>
                        {step.details && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <pre className="font-mono">
                              {JSON.stringify(step.details, null, 2)}
                            </pre>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Error Display */}
              {progress.error && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="text-lg text-red-800 dark:text-red-200">
                      Error
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {progress.error}
                    </p>
                    {/* SAM.gov workspace URL guidance */}
                    {progress.error.toLowerCase().includes('workspace') &&
                      progress.error.toLowerCase().includes('sam.gov') && (
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-md">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                            How to fix this:
                          </p>
                          <ol className="text-sm text-amber-700 dark:text-amber-300 list-decimal list-inside space-y-1">
                            <li>
                              Go to the SAM.gov opportunity page while logged in
                            </li>
                            <li>
                              Copy the URL from the public view (format:
                              sam.gov/opp/...)
                            </li>
                            <li>
                              Paste the public URL in the form and try again
                            </li>
                          </ol>
                          {/* Extract suggested URL from error message if present */}
                          {progress.error.match(
                            /sam\.gov\/opp\/[a-zA-Z0-9]+\/view/i
                          ) && (
                            <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded">
                              <p className="text-xs font-medium text-green-800 dark:text-green-200">
                                Suggested URL found in error:
                              </p>
                              <code className="text-xs text-green-700 dark:text-green-300 break-all">
                                https://
                                {progress.error.match(
                                  /sam\.gov\/opp\/[a-zA-Z0-9]+\/view/i
                                )?.[0] || ''}
                              </code>
                            </div>
                          )}
                        </div>
                      )}
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex justify-end gap-3">
                    {progress.status === 'completed' && progress.rfpId ? (
                      <Button
                        onClick={() => {
                          if (onComplete && progress.rfpId) {
                            onComplete(progress.rfpId);
                          }
                        }}
                        className="gap-2"
                      >
                        👁️ View RFP Details
                      </Button>
                    ) : progress.status === 'failed' ? (
                      <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                      >
                        Close
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={progress.status === 'processing'}
                        className="gap-2"
                      >
                        📋 Minimize
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Loading State */}
          {!progress && isConnected && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">
                    Initializing RFP processing...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Connection Error State with Retry */}
          {connectionError && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
              <CardContent className="py-8">
                <div className="text-center">
                  <div className="text-4xl mb-4">❌</div>
                  <p className="text-red-700 dark:text-red-300 mb-2 font-medium">
                    Connection Failed
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {connectionError}
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setConnectionError(null);
                        setAttemptCount(0);
                        // Trigger reconnect by toggling a state
                        setRetryTrigger(prev => prev + 1);
                      }}
                    >
                      🔄 Retry Connection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reconnecting State */}
          {!isConnected && !connectionError && attemptCount > 0 && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/50 dark:border-yellow-800">
              <CardContent className="py-6">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-yellow-700 dark:text-yellow-300">
                    Reconnecting... (attempt {attemptCount} of {MAX_RECONNECT_ATTEMPTS})
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Initial Connecting State */}
          {!isConnected && !connectionError && attemptCount === 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800">
              <CardContent className="py-6">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-700 dark:text-blue-300">
                    Connecting to progress stream...
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
