import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useWizard } from '../context';

interface GenerationProgress {
  step: string;
  status: string;
  message: string;
  progress: number;
}

export function useWizardGeneration() {
  const { state, dispatch } = useWizard();
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const startGeneration = useMutation({
    mutationFn: async () => {
      const selectedReqs = state.requirements
        .filter(r => r.selected)
        .map(r => ({
          id: r.id,
          text: r.text,
          category: r.category,
          section: r.section,
        }));

      const sectionNotes: Record<string, string> = {};
      state.sections.forEach(s => {
        if (s.userNotes) sectionNotes[s.id] = s.userNotes;
      });

      return apiRequest('POST', '/api/proposals/wizard/generate', {
        rfpId: state.rfpId,
        selectedRequirements: selectedReqs,
        sectionNotes,
        qualityLevel: 'standard',
      }) as Promise<{ success: boolean; sessionId: string }>;
    },
    onSuccess: data => {
      dispatch({ type: 'SET_SESSION_ID', payload: data.sessionId });
    },
    onError: (error: Error) => {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    },
  });

  // SSE connection for progress
  useEffect(() => {
    if (!state.sessionId) return;

    const eventSource = new EventSource(
      `/api/proposals/wizard/stream/${state.sessionId}`
    );

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);

        // Update section statuses based on progress
        if (data.step === 'content_generation' && data.message) {
          const sectionMatch = data.message.match(/Generating (\w+)/);
          if (sectionMatch) {
            const sectionId = sectionMatch[1];
            dispatch({
              type: 'SET_SECTION_STATUS',
              payload: { sectionId, status: 'generating' },
            });
          }
        }

        // Calculate overall progress
        const progressPercent = data.progress || 0;
        dispatch({
          type: 'SET_GENERATION_PROGRESS',
          payload: { progress: progressPercent, section: data.step },
        });

        // Move to next step on completion
        if (data.step === 'completion' && data.status === 'completed') {
          state.sections.forEach(s => {
            dispatch({
              type: 'SET_SECTION_STATUS',
              payload: { sectionId: s.id, status: 'completed' },
            });
          });
          setTimeout(() => {
            dispatch({ type: 'NEXT_STEP' });
          }, 1000);
        }
      } catch (e) {
        console.error('Failed to parse SSE message:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [state.sessionId, state.sections, dispatch]);

  return {
    startGeneration: startGeneration.mutate,
    isStarting: startGeneration.isPending,
    progress,
  };
}
