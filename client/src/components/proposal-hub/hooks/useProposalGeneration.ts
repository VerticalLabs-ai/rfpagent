import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface GenerateProposalOptions {
  rfpId: string;
  companyProfileId?: string;
  options?: Record<string, any>;
}

export function useProposalGeneration() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async ({ rfpId, companyProfileId, options }: GenerateProposalOptions) => {
      // Get company profile if not provided
      let profileId = companyProfileId;
      if (!profileId) {
        const profilesResponse = await fetch('/api/company/profiles');
        const profiles = await profilesResponse.json();

        if (!profiles || profiles.length === 0) {
          throw new Error('No company profiles found. Please create a company profile first.');
        }
        profileId = profiles[0].id;
      }

      return apiRequest('POST', '/api/proposals/enhanced/generate', {
        rfpId,
        companyProfileId: profileId,
        options: options || {},
      });
    },
    onMutate: () => {
      // Create immediate session ID for progress tracking
      const immediateSessionId = `session_${Date.now()}`;
      setSessionId(immediateSessionId);
      return { immediateSessionId };
    },
    onSuccess: (data: any, _variables, context) => {
      // Update with real session ID from server
      const realSessionId = data?.sessionId || context.immediateSessionId;
      setSessionId(realSessionId);

      toast({
        title: 'Proposal Generation Started',
        description: `AI agents are processing your RFP. Session: ${realSessionId.substring(0, 20)}...`,
      });
    },
    onError: (error: any) => {
      setSessionId(null);
      toast({
        title: 'Generation Failed',
        description: error?.message || 'Failed to start proposal generation. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const startGeneration = (rfpId: string, options?: Record<string, any>) => {
    generateMutation.mutate({ rfpId, options });
  };

  const resetGeneration = () => {
    setSessionId(null);
    generateMutation.reset();
  };

  return {
    sessionId,
    isGenerating: generateMutation.isPending || !!sessionId,
    error: generateMutation.error,
    startGeneration,
    resetGeneration,
  };
}
