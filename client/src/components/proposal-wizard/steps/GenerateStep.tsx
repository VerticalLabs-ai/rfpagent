import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  Loader2,
  Circle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useWizard } from '../context';
import { useWizardGeneration } from '../hooks/useWizardGeneration';
import { cn } from '@/lib/utils';

export function GenerateStep() {
  const { state } = useWizard();
  const { startGeneration, isStarting, progress } = useWizardGeneration();

  // Auto-start generation when entering this step
  useEffect(() => {
    if (!state.sessionId && !isStarting) {
      startGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSectionIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'generating':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Generating Your Proposal</h2>
        <p className="text-muted-foreground">
          AI is creating each section based on your requirements and notes
        </p>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {state.generationProgress}%
            </span>
          </div>
          <Progress value={state.generationProgress} className="h-2" />
          {progress?.message && (
            <p className="text-xs text-muted-foreground mt-2">
              {progress.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {state.sections.map(section => (
          <div
            key={section.id}
            className={cn(
              'flex items-center gap-3 p-4 border rounded-lg transition-colors',
              section.status === 'generating' &&
                'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
              section.status === 'completed' &&
                'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
              section.status === 'error' &&
                'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
            )}
          >
            {getSectionIcon(section.status)}
            <span className="font-medium text-sm">{section.displayName}</span>
            {section.status === 'generating' && (
              <Badge variant="secondary" className="ml-auto text-xs">
                In Progress
              </Badge>
            )}
            {section.status === 'completed' && (
              <Badge className="ml-auto text-xs bg-green-500">Complete</Badge>
            )}
          </div>
        ))}
      </div>

      {state.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div className="flex-1">
              <p className="font-medium text-red-700 dark:text-red-400">
                Generation Error
              </p>
              <p className="text-sm text-red-600 dark:text-red-300">
                {state.error}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startGeneration()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
