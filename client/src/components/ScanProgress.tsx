import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  FileText,
  AlertCircle,
  Wifi,
  WifiOff,
  RotateCcw,
} from 'lucide-react';
import { ScanState, ScanEvent } from '@/hooks/useScanStream';
import { formatDistanceToNow } from 'date-fns';

interface ScanProgressProps {
  portalId: string;
  scanState: ScanState | null;
  isConnected: boolean;
  error: string | null;
  onReconnect: () => void;
  onDisconnect: () => void;
}

const stepIcons = {
  initializing: Activity,
  authenticating: Activity,
  authenticated: CheckCircle,
  navigating: Activity,
  extracting: Activity,
  parsing: Activity,
  saving: Activity,
  completed: CheckCircle,
  failed: XCircle,
};

const stepLabels = {
  initializing: 'Initializing',
  authenticating: 'Authenticating',
  authenticated: 'Authenticated',
  navigating: 'Navigating Portal',
  extracting: 'Extracting Content',
  parsing: 'Parsing RFPs',
  saving: 'Saving Results',
  completed: 'Completed',
  failed: 'Failed',
};

const getStepColor = (step: string) => {
  switch (step) {
    case 'completed':
      return 'text-green-600 dark:text-green-400';
    case 'failed':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
};

const getEventIcon = (type: string) => {
  switch (type) {
    case 'rfp_discovered':
      return FileText;
    case 'error':
      return AlertCircle;
    case 'scan_completed':
      return CheckCircle;
    case 'scan_failed':
      return XCircle;
    default:
      return Activity;
  }
};

const getEventColor = (type: string) => {
  switch (type) {
    case 'rfp_discovered':
      return 'text-green-600 dark:text-green-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'scan_completed':
      return 'text-green-600 dark:text-green-400';
    case 'scan_failed':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

export function ScanProgress({
  scanState,
  isConnected,
  error,
  onReconnect,
  onDisconnect,
}: ScanProgressProps) {
  if (!scanState) {
    return (
      <Card data-testid="card-scan-progress">
        <CardContent className="p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            No active scan
          </div>
        </CardContent>
      </Card>
    );
  }

  const StepIcon = stepIcons[scanState.currentStep.step] || Activity; // Fallback to Activity icon
  const stepColor = getStepColor(scanState.currentStep.step);

  return (
    <Card data-testid="card-scan-progress">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <StepIcon className={`h-5 w-5 ${stepColor}`} />
            <span data-testid="text-portal-name">
              {scanState.portalName || 'Portal Scan'}
            </span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi
                className="h-4 w-4 text-green-500"
                data-testid="icon-connected"
              />
            ) : (
              <WifiOff
                className="h-4 w-4 text-red-500"
                data-testid="icon-disconnected"
              />
            )}
            <Badge
              variant={
                scanState.status === 'completed'
                  ? 'default'
                  : scanState.status === 'failed'
                    ? 'destructive'
                    : 'secondary'
              }
              data-testid={`badge-status-${scanState.status}`}
            >
              {scanState.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Error */}
        {error && (
          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span
                className="text-sm text-red-700 dark:text-red-300"
                data-testid="text-error"
              >
                {error}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onReconnect}
              data-testid="button-reconnect"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reconnect
            </Button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span data-testid="text-current-step">
              {stepLabels[scanState.currentStep.step]}
            </span>
            <span data-testid="text-progress-percent">
              {scanState.currentStep.progress}%
            </span>
          </div>
          <Progress
            value={scanState.currentStep.progress}
            className="h-2"
            data-testid="progress-scan"
          />
          <p
            className="text-sm text-gray-600 dark:text-gray-400"
            data-testid="text-step-message"
          >
            {scanState.currentStep.message}
          </p>
        </div>

        {/* Scan Metrics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div
              className="text-2xl font-bold text-green-600 dark:text-green-400"
              data-testid="text-rfps-count"
            >
              {scanState.rfpsDiscovered.length}
            </div>
            <div className="text-xs text-gray-500">RFPs Found</div>
          </div>
          <div className="space-y-1">
            <div
              className="text-2xl font-bold text-blue-600 dark:text-blue-400"
              data-testid="text-events-count"
            >
              {scanState.events.length}
            </div>
            <div className="text-xs text-gray-500">Events</div>
          </div>
          <div className="space-y-1">
            <div
              className="text-2xl font-bold text-purple-600 dark:text-purple-400"
              data-testid="text-duration"
            >
              {scanState.startedAt &&
              !isNaN(new Date(scanState.startedAt).getTime())
                ? formatDistanceToNow(scanState.startedAt, { addSuffix: false })
                : '0s'}
            </div>
            <div className="text-xs text-gray-500">Duration</div>
          </div>
        </div>

        <Separator />

        {/* Activity Feed */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Activity Feed</h4>
          <ScrollArea className="h-32 w-full rounded border p-2">
            <div className="space-y-2" data-testid="feed-activity">
              {scanState.events
                .slice(-10)
                .reverse()
                .map((event, index) => {
                  const EventIcon = getEventIcon(event.type);
                  const eventColor = getEventColor(event.type);

                  return (
                    <div
                      key={index}
                      className="flex items-start space-x-2 text-xs"
                    >
                      <EventIcon
                        className={`h-3 w-3 mt-0.5 ${eventColor} flex-shrink-0`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium capitalize">
                            {event.type.replace('_', ' ')}
                          </span>
                          <span className="text-gray-500">
                            {(() => {
                              const timestamp = new Date(event.timestamp);
                              return !isNaN(timestamp.getTime())
                                ? timestamp.toLocaleTimeString()
                                : 'Invalid Date';
                            })()}
                          </span>
                        </div>
                        {event.data && (
                          <div className="text-gray-600 dark:text-gray-400 mt-1">
                            {event.type === 'rfp_discovered' ? (
                              <span data-testid={`text-rfp-${index}`}>
                                RFP: {event.data.title} ({event.data.agency})
                              </span>
                            ) : event.type === 'step_update' ? (
                              <span>{event.data.message}</span>
                            ) : event.type === 'log' ? (
                              <span>{event.data.message}</span>
                            ) : (
                              <span>{JSON.stringify(event.data)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              {scanState.events.length === 0 && (
                <div className="text-center text-gray-400 py-4">
                  No activity yet
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Actions */}
        {scanState.status === 'running' && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={onDisconnect}
              data-testid="button-disconnect"
            >
              Disconnect
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
