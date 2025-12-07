import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Loader2, FileSearch } from 'lucide-react';
import { useWizard } from '../context';
import { apiRequest } from '@/lib/queryClient';
import type { ExtractedRequirement } from '../types';

interface ExtractionResponse {
  success: boolean;
  requirements: Array<{
    id: string;
    text: string;
    category: string;
    section: string;
    description?: string;
  }>;
  keyDates?: {
    deadline?: string;
    prebidMeeting?: string | null;
    questionsDeadline?: string | null;
  };
  riskFlags?: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
}

export function AnalyzeRequirementsStep() {
  const { state, dispatch } = useWizard();
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const extractMutation = useMutation({
    mutationFn: async () => {
      const selectedDocIds = state.attachments.filter(a => a.selected).map(a => a.id);

      return apiRequest('POST', '/api/proposals/wizard/extract-requirements', {
        rfpId: state.rfpId,
        documentIds: selectedDocIds,
      }) as Promise<ExtractionResponse>;
    },
    onSuccess: data => {
      const requirements: ExtractedRequirement[] = data.requirements.map(req => ({
        id: req.id,
        text: req.text,
        category: req.category as 'mandatory' | 'preferred' | 'optional',
        section: req.section,
        selected: req.category === 'mandatory', // Auto-select mandatory requirements
      }));
      dispatch({ type: 'SET_REQUIREMENTS', payload: requirements });
      dispatch({ type: 'SET_ERROR', payload: null });
    },
    onError: (error: Error) => {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to analyze requirements' });
    },
  });

  // Auto-start analysis when step is reached
  useEffect(() => {
    if (state.rfpId && state.requirements.length === 0 && !extractMutation.isPending) {
      extractMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.rfpId]);

  // Simulate progress during analysis
  useEffect(() => {
    if (extractMutation.isPending) {
      setAnalysisProgress(0);
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);
      return () => clearInterval(interval);
    } else if (extractMutation.isSuccess) {
      setAnalysisProgress(100);
    }
  }, [extractMutation.isPending, extractMutation.isSuccess]);

  const mandatoryCount = state.requirements.filter(r => r.category === 'mandatory').length;
  const preferredCount = state.requirements.filter(r => r.category === 'preferred').length;
  const optionalCount = state.requirements.filter(r => r.category === 'optional').length;

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Analyzing RFP Requirements</h2>
        <p className="text-muted-foreground">AI is extracting requirements from {state.rfpTitle}</p>
      </div>

      {extractMutation.isPending && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <FileSearch className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Analyzing Documents</p>
                <p className="text-sm text-muted-foreground">
                  Extracting requirements, compliance items, and key dates...
                </p>
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
            <Progress value={analysisProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {Math.round(analysisProgress)}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {extractMutation.isSuccess && state.requirements.length > 0 && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Analysis Complete</p>
                <p className="text-sm text-muted-foreground">
                  Found {state.requirements.length} requirements
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{mandatoryCount}</p>
                <p className="text-xs text-muted-foreground">Mandatory</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {preferredCount}
                </p>
                <p className="text-xs text-muted-foreground">Preferred</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{optionalCount}</p>
                <p className="text-xs text-muted-foreground">Optional</p>
              </div>
            </div>

            <p className="text-sm text-center text-muted-foreground mt-4">
              Click Continue to review and select which requirements to address
            </p>
          </CardContent>
        </Card>
      )}

      {extractMutation.isError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Analysis Failed</p>
                <p className="text-sm text-muted-foreground">
                  {extractMutation.error?.message || 'An error occurred during analysis'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
