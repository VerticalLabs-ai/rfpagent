import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Loader2, AlertCircle, Pause, Play, X } from 'lucide-react';
import { GenerationProgress as GenerationProgressType } from '../types';

interface GenerationProgressProps {
  progress: GenerationProgressType;
  elapsedTime: number;
  onCancel?: () => void;
}

export function GenerationProgress({
  progress,
  elapsedTime,
  onCancel,
}: GenerationProgressProps) {
  const [isPaused, setIsPaused] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            Generating Proposal
            <Badge variant="secondary" className="ml-2">
              {formatTime(elapsedTime)}
            </Badge>
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Future: Pause/Resume functionality
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </Button>
            */}
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {progress.overallProgress}%
            </span>
          </div>
          <Progress value={progress.overallProgress} className="h-2" />
        </div>

        {/* Session ID */}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Session ID:</span>{' '}
          <code className="bg-muted px-1 py-0.5 rounded">
            {progress.sessionId.substring(0, 24)}...
          </code>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {progress.steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                step.status === 'in_progress'
                  ? 'bg-blue-100 dark:bg-blue-950/30'
                  : step.status === 'completed'
                    ? 'bg-green-50 dark:bg-green-950/20'
                    : 'bg-muted/50'
              }`}
            >
              <div className="mt-0.5">{getStepIcon(step.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{step.name}</div>
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              </div>
              {step.status === 'in_progress' && step.progress !== undefined && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {step.progress}%
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Helpful tip */}
        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <p className="text-sm text-muted-foreground">
            💡 <span className="font-medium">Tip:</span> You can scroll down to view
            past proposals while generation continues.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
