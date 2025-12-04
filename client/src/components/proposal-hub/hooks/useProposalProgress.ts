import { useState, useEffect, useCallback } from 'react';
import { GenerationProgress, GENERATION_STEPS } from '../types';

export function useProposalProgress(sessionId: string | null) {
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Initialize progress when session starts
  useEffect(() => {
    if (!sessionId || progress) return;

    // Defer setState to avoid cascading renders
    setTimeout(() => {
      setProgress({
        sessionId,
        currentStep: 'init',
        overallProgress: 0,
        steps: [...GENERATION_STEPS],
        elapsedTime: 0,
      });
    }, 0);
  }, [sessionId, progress]);

  // Track elapsed time
  useEffect(() => {
    if (!sessionId) {
      // Defer setState to avoid cascading renders
      setTimeout(() => setElapsedTime(0), 0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId]);

  // SSE connection for real-time progress
  useEffect(() => {
    if (!sessionId) {
      // Defer setState to avoid cascading renders
      setTimeout(() => setProgress(null), 0);
      return;
    }

    console.log(`📡 Connecting to SSE for session: ${sessionId}`);
    const eventSource = new EventSource(
      `/api/proposals/submission-materials/progress/${sessionId}`
    );

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        console.log('📊 Progress update:', data);

        setProgress(prev => {
          if (!prev) return null;

          const updatedSteps = [...prev.steps];
          const stepIndex = updatedSteps.findIndex(s => s.id === data.step);

          if (stepIndex !== -1) {
            updatedSteps[stepIndex] = {
              ...updatedSteps[stepIndex],
              status: data.status || 'in_progress',
              progress: data.progress,
            };
          }

          // Calculate overall progress
          const completedSteps = updatedSteps.filter(
            s => s.status === 'completed'
          ).length;
          const totalSteps = updatedSteps.length;
          const overallProgress = Math.round(
            (completedSteps / totalSteps) * 100
          );

          return {
            ...prev,
            currentStep: data.step || prev.currentStep,
            overallProgress,
            steps: updatedSteps,
            elapsedTime,
          };
        });
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = error => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    return () => {
      console.log('🔌 Closing SSE connection');
      eventSource.close();
    };
  }, [sessionId, elapsedTime]);

  const resetProgress = useCallback(() => {
    setProgress(null);
    setElapsedTime(0);
  }, []);

  return {
    progress,
    elapsedTime,
    resetProgress,
  };
}
