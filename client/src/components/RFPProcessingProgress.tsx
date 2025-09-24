import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

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
    const sseEndpoint = endpoint || `/api/rfps/manual/progress/${sessionId}`;

    // Add a small delay to ensure backend processing has started
    const connectionDelay = setTimeout(() => {
      // Create EventSource for SSE connection
      eventSource = new EventSource(sseEndpoint);

      eventSource.onopen = () => {
        console.log('📡 SSE connection opened');
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
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

        // If the EventSource is closed due to error, try to reconnect once
        if (eventSource?.readyState === EventSource.CLOSED) {
          console.log('📡 Connection closed, attempting one reconnection...');
          setTimeout(() => {
            if (eventSource?.readyState === EventSource.CLOSED) {
              console.log('📡 Attempting to reconnect...');
              // The browser will automatically reconnect for SSE, but we can force it
              try {
                eventSource.close();
                const newEventSource = new EventSource(sseEndpoint);
                eventSource = newEventSource;
                // Re-attach handlers...
              } catch (reconnectError) {
                console.error('📡 Reconnection failed:', reconnectError);
              }
            }
          }, 2000);
        }
      };
    }, 500); // 500ms delay to ensure backend is ready

    // Cleanup function
    return () => {
      clearTimeout(connectionDelay);
      if (eventSource) {
        console.log('📡 Closing SSE connection');
        eventSource.close();
        setIsConnected(false);
      }
    };
  }, [sessionId, open, onComplete, onError]);

  const getStepIcon = (status: ProgressStep['status']) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔄';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status: ProgressStep['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const progressPercentage = progress
    ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fas fa-cogs"></i>
            Processing RFP
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-muted-foreground">
              {isConnected ? 'Connected to progress stream' : 'Connecting...'}
            </span>
          </div>

          {progress && (
            <>
              {/* Overall Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Overall Progress</h3>
                  <span className="text-sm text-muted-foreground">
                    {progress.completedSteps}/{progress.totalSteps} steps
                  </span>
                </div>
                <Progress value={progressPercentage} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  {progress.currentStep}
                </p>
              </div>

              {/* Current Status */}
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

              {/* Processing URL */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Processing URL:</p>
                <p className="text-sm text-muted-foreground break-all">
                  {progress.url}
                </p>
              </div>

              {/* Step Details */}
              <div className="space-y-3">
                <h4 className="font-medium">Processing Steps</h4>
                <div className="space-y-2">
                  {progress.steps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        step.status === 'in_progress' ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' :
                        step.status === 'completed' ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' :
                        step.status === 'failed' ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' :
                        'bg-gray-50 border-gray-200 dark:bg-gray-950 dark:border-gray-800'
                      }`}
                    >
                      <span className="text-lg flex-shrink-0">
                        {getStepIcon(step.status)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium text-sm text-foreground">{step.step}</h5>
                          <Badge
                            variant={step.status === 'completed' ? 'default' : 'secondary'}
                            className={`text-xs ${getStatusColor(step.status)}`}
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
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Display */}
              {progress.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Error</h4>
                  <p className="text-sm text-red-700 dark:text-red-300">{progress.error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {progress.status === 'completed' && progress.rfpId ? (
                  <Button
                    onClick={() => {
                      if (onComplete && progress.rfpId) {
                        onComplete(progress.rfpId);
                      }
                    }}
                  >
                    <i className="fas fa-eye mr-2"></i>
                    View RFP Details
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
                  >
                    <i className="fas fa-minimize mr-2"></i>
                    Minimize
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Loading State */}
          {!progress && isConnected && (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground mb-4"></i>
              <p className="text-muted-foreground">
                Initializing RFP processing...
              </p>
            </div>
          )}

          {/* Connection Failed State */}
          {!isConnected && (
            <div className="text-center py-8">
              <i className="fas fa-exclamation-triangle text-2xl text-yellow-500 mb-4"></i>
              <p className="text-muted-foreground">
                Failed to connect to progress stream
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="mt-4"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}