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
  endpoint
}: RFPProcessingProgressProps) {
  const [progress, setProgress] = useState<RFPProcessingProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!open || !sessionId) return;

    console.log(`📡 Connecting to progress stream for session: ${sessionId}`);

    let eventSource: EventSource | null = null;
    let isCleaningUp = false;
    let reconnectTimer: NodeJS.Timeout | null = null;
    const sseEndpoint = endpoint || `/api/rfps/manual/progress/${sessionId}`;

    const connectToStream = () => {
      if (isCleaningUp || eventSource?.readyState === EventSource.OPEN) return;

      // Close existing connection if any
      if (eventSource) {
        eventSource.close();
      }

      try {
        // Create EventSource for SSE connection
        eventSource = new EventSource(sseEndpoint);

        eventSource.onopen = () => {
          console.log('📡 SSE connection opened');
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          if (isCleaningUp) return;

          try {
            const data = JSON.parse(event.data);
            console.log('📡 Received SSE message:', data);

            switch (data.type) {
              case 'connected':
                console.log('📡 SSE connected to session');
                break;

              case 'progress':
                console.log('📡 Progress update received:', data.data?.status, data.data?.currentStep);
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
                console.log('📡 Heartbeat received');
                break;

              default:
                console.log('📡 Unknown message type:', data.type);
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('📡 SSE connection error:', error);
          setIsConnected(false);

          // Clear any existing reconnect timer
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
          }

          // Only attempt reconnection if not cleaning up and connection is closed
          if (!isCleaningUp && (!eventSource || eventSource.readyState === EventSource.CLOSED)) {
            console.log('📡 Connection closed, will retry in 2 seconds...');
            reconnectTimer = setTimeout(() => {
              if (!isCleaningUp) {
                connectToStream();
              }
            }, 2000);
          }
        };
      } catch (error) {
        console.error('📡 Failed to create EventSource:', error);
        setIsConnected(false);
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
  }, [sessionId, open, onComplete, onError, endpoint]);

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

  const getStatusColor = (status: ProgressStep['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
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
            🔄
            Processing RFP
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection Status */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`}></div>
                  <span className="text-sm text-muted-foreground">
                    {isConnected ? 'Connected to progress stream' : 'Connecting to progress stream...'}
                  </span>
                </div>
                {!isConnected && (
                  <span className="text-xs text-muted-foreground">
                    Reconnecting due to code updates...
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

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
                    <Badge variant={progress.status === 'completed' ? 'default' : 'secondary'}>
                      {progress.status}
                    </Badge>
                    {progress.rfpId && (
                      <Badge variant="outline">
                        ID: {progress.rfpId.substring(0, 8)}...
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Processing URL:</p>
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
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                        step.status === 'completed' ? 'bg-green-500 text-white' :
                        step.status === 'in_progress' ? 'bg-blue-500 text-white' :
                        step.status === 'failed' ? 'bg-red-500 text-white' :
                        'bg-gray-200 text-gray-500'
                      }`}>
                        {getStepIcon(step.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-sm text-foreground">{step.step}</h5>
                          <Badge
                            variant={step.status === 'completed' ? 'default' : 'secondary'}
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
                    <CardTitle className="text-lg text-red-800 dark:text-red-200">Error</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-red-700 dark:text-red-300">{progress.error}</p>
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

          {/* Connection Failed State */}
          {!isConnected && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/50 dark:border-yellow-800">
              <CardContent className="py-8">
                <div className="text-center">
                  <div className="text-4xl mb-4">⚠️</div>
                  <p className="text-muted-foreground mb-4">
                    Failed to connect to progress stream
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}