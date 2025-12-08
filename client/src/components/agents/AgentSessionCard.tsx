import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentWorkSession } from '@shared/api/agentTracking';

interface AgentSessionCardProps {
  session: AgentWorkSession;
  compact?: boolean;
}

const tierColors = {
  orchestrator:
    'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  manager: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  specialist:
    'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
};

const statusIcons = {
  queued: Clock,
  in_progress: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
  paused: Clock,
};

const statusColors = {
  queued: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  in_progress: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  completed: 'bg-green-500/10 text-green-700 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400',
  paused: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

export function AgentSessionCard({
  session,
  compact = false,
}: AgentSessionCardProps) {
  const StatusIcon = statusIcons[session.status];

  if (compact && session.status === 'completed') {
    return (
      <div className="flex items-center justify-between py-2 px-3 border-b last:border-b-0">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">
            {session.agentDisplayName}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn('text-xs', tierColors[session.agentTier])}
        >
          {session.agentTier}
        </Badge>
      </div>
    );
  }

  return (
    <Card className={cn('transition-all', compact && 'shadow-sm')}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm truncate">
                  {session.agentDisplayName}
                </h4>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs shrink-0',
                    tierColors[session.agentTier]
                  )}
                >
                  {session.agentTier}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {session.taskType}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn('shrink-0', statusColors[session.status])}
            >
              <StatusIcon
                className={cn(
                  'h-3 w-3 mr-1',
                  session.status === 'in_progress' && 'animate-spin'
                )}
              />
              {session.status.replace('_', ' ')}
            </Badge>
          </div>

          {/* Current Step (if available) */}
          {session.currentStep && session.status === 'in_progress' && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Current: </span>
              {session.currentStep}
            </div>
          )}

          {/* Progress Bar (for active sessions) */}
          {session.status === 'in_progress' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{session.progress}%</span>
              </div>
              <Progress value={session.progress} className="h-2" />
            </div>
          )}

          {/* Error Message (if failed) */}
          {session.status === 'failed' && session.error && (
            <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400">
                {session.error}
              </p>
            </div>
          )}

          {/* Timing Information */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>
                Started{' '}
                {new Date(session.startedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {session.completedAt && (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                <span>
                  Completed{' '}
                  {new Date(session.completedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Metrics (if available and completed) */}
          {session.status === 'completed' &&
            session.metrics &&
            Object.keys(session.metrics).length > 0 && (
              <div className="flex items-center gap-3 pt-2 border-t text-xs text-muted-foreground">
                {session.metrics.tokensUsed && (
                  <span>
                    <span className="font-medium">
                      {session.metrics.tokensUsed.toLocaleString()}
                    </span>{' '}
                    tokens
                  </span>
                )}
                {session.metrics.executionTimeMs && (
                  <span>
                    <span className="font-medium">
                      {(session.metrics.executionTimeMs / 1000).toFixed(1)}s
                    </span>{' '}
                    duration
                  </span>
                )}
                {session.metrics.retryCount &&
                  session.metrics.retryCount > 0 && (
                    <span>
                      <span className="font-medium">
                        {session.metrics.retryCount}
                      </span>{' '}
                      retries
                    </span>
                  )}
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
