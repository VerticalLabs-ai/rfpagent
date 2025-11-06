import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProposalGenerationProgressProps {
  sessionId: string;
  isVisible: boolean;
  onComplete: () => void;
  onError: (error: string) => void;
}

interface ProgressStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress?: number;
}

const GENERATION_STEPS: ProgressStep[] = [
  {
    id: 'init',
    name: 'Initializing',
    description: 'Setting up proposal generation',
    status: 'pending',
  },
  {
    id: 'analysis',
    name: 'Document Analysis',
    description: 'Analyzing RFP requirements with AI agents',
    status: 'pending',
  },
  {
    id: 'proposal_manager',
    name: 'Proposal Planning',
    description: 'Planning proposal structure and approach',
    status: 'pending',
  },
  {
    id: 'content_generator',
    name: 'Content Generation',
    description: 'Generating proposal content with Mastra agents',
    status: 'pending',
  },
  {
    id: 'compliance_checker',
    name: 'Compliance Check',
    description: 'Ensuring proposal meets all requirements',
    status: 'pending',
  },
  {
    id: 'finalization',
    name: 'Finalizing',
    description: 'Completing proposal generation',
    status: 'pending',
  },
];

export function ProposalGenerationProgress({
  sessionId,
  isVisible,
  onComplete,
  onError,
}: ProposalGenerationProgressProps) {
  const [steps, setSteps] = useState<ProgressStep[]>(GENERATION_STEPS);
  const [currentStep, setCurrentStep] = useState<string>('init');
  const [overallProgress, setOverallProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug logging
  console.log('ProposalGenerationProgress props:', { sessionId, isVisible });

  useEffect(() => {
    if (!isVisible || !sessionId) return;

    console.log(`📡 Connecting to SSE endpoint for session: ${sessionId}`);

    // Start timer
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    // Connect to Server-Sent Events for real-time progress
    const eventSource = new EventSource(
      `/api/proposals/submission-materials/progress/${sessionId}`
    );

    eventSource.onopen = () => {
      console.log(`📡 SSE connection established for session: ${sessionId}`);
    };

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 SSE message received:', data);

        if (data.type === 'connected') {
          console.log('📡 Connected to progress stream');
        } else if (data.type === 'progress') {
          const progressData = data.data;

          // Map backend step IDs to frontend step IDs
          const stepMapping: Record<string, string> = {
            initialization: 'init',
            rfp_analysis: 'analysis',
            company_profile: 'proposal_manager',
            content_generation: 'content_generator',
            compliance_check: 'compliance_checker',
            document_assembly: 'content_generator',
            quality_review: 'compliance_checker',
            completion: 'finalization',
          };

          // Update overall progress
          const progress = Math.round(
            (progressData.completedSteps / progressData.totalSteps) * 100
          );
          setOverallProgress(progress);

          // Update steps based on backend progress
          setSteps(prev =>
            prev.map(step => {
              // Find matching backend step
              const backendStep = progressData.steps.find((s: any) => {
                const backendStepId = s.step
                  .toLowerCase()
                  .replace(/\s+/g, '_')
                  .replace(/[^a-z0-9_]/g, '');
                return stepMapping[backendStepId] === step.id;
              });

              if (backendStep) {
                return {
                  ...step,
                  status: backendStep.status as any,
                };
              }
              return step;
            })
          );

          // Update current step
          if (progressData.currentStep) {
            setCurrentStep(progressData.currentStep);
          }

          // Handle completion
          if (progressData.status === 'completed') {
            setIsCompleted(true);
            onComplete();
            eventSource.close();
          } else if (progressData.status === 'failed') {
            setError(progressData.error || 'Proposal generation failed');
            onError(progressData.error || 'Proposal generation failed');
            eventSource.close();
          }
        } else if (data.type === 'complete') {
          console.log('📡 Workflow complete:', data);
          setIsCompleted(true);
          onComplete();
          eventSource.close();
        } else if (data.type === 'error') {
          console.error('📡 Workflow error:', data.error);
          setError(data.error);
          onError(data.error);
          eventSource.close();
        } else if (data.type === 'heartbeat') {
          // Heartbeat received, connection is alive
          console.log('📡 Heartbeat received');
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = error => {
      console.error('📡 SSE error:', error);
      // Don't close immediately on error - let reconnection happen
      // Only show error if connection repeatedly fails
    };

    return () => {
      console.log(`📡 Cleaning up SSE connection for session: ${sessionId}`);
      clearInterval(timer);
      eventSource.close();
    };
  }, [isVisible, sessionId, onComplete, onError]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Generating Proposal
          </CardTitle>
          <Badge variant="outline" className="text-sm">
            {formatTime(elapsedTime)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {overallProgress}%
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Session Info */}
        <div className="text-sm text-muted-foreground">
          Session ID:{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            {sessionId}
          </code>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                step.status === 'in_progress'
                  ? 'bg-blue-50 border-blue-200'
                  : step.status === 'completed'
                    ? 'bg-green-50 border-green-200'
                    : step.status === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-muted/30 border-border'
              }`}
            >
              {/* Status Icon */}
              <div className="shrink-0">
                {step.status === 'completed' && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                {step.status === 'in_progress' && (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                )}
                {step.status === 'error' && (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                {step.status === 'pending' && (
                  <Clock className="h-5 w-5 text-gray-400" />
                )}
              </div>

              {/* Step Info */}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium ${
                    step.status === 'in_progress'
                      ? 'text-blue-900'
                      : step.status === 'completed'
                        ? 'text-green-900'
                        : step.status === 'error'
                          ? 'text-red-900'
                          : 'text-gray-700'
                  }`}
                >
                  {step.name}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              </div>

              {/* Step Badge */}
              <div className="shrink-0">
                <Badge
                  variant={
                    step.status === 'completed'
                      ? 'default'
                      : step.status === 'in_progress'
                        ? 'secondary'
                        : step.status === 'error'
                          ? 'destructive'
                          : 'outline-solid'
                  }
                  className="text-xs"
                >
                  {step.status === 'completed' && 'Done'}
                  {step.status === 'in_progress' && 'Processing'}
                  {step.status === 'error' && 'Error'}
                  {step.status === 'pending' && 'Waiting'}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* AI Agent Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-blue-900">
              3-Tier Mastra AI System Active
            </span>
          </div>
          <p className="text-xs text-blue-700">
            Our specialized AI agents are analyzing your RFP requirements and
            generating a comprehensive proposal using the latest Mastra
            framework.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">
                Generation Failed
              </span>
            </div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">
                Generation Complete!
              </span>
            </div>
            <p className="text-sm text-green-700">
              Your proposal has been generated successfully. It will appear in
              the proposals section below.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
