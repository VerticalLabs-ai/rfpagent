import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Proposal } from '../types';

export function useProposals(rfpId: string) {
  const { toast } = useToast();

  // Fetch proposals
  const {
    data: proposals = [],
    isLoading,
    error,
  } = useQuery<Proposal[]>({
    queryKey: ['/api/proposals/rfp', rfpId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/proposals/rfp/${rfpId}`);
        if (!response.ok) {
          if (response.status === 404) return [];
          console.warn('Failed to fetch proposals:', response.status);
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.warn('Error fetching proposals:', err);
        return [];
      }
    },
    enabled: !!rfpId,
    retry: false,
  });

  // Delete proposal
  const deleteProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete proposal');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Proposal Deleted',
        description: 'The proposal has been deleted successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals/rfp', rfpId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error?.message || 'Failed to delete proposal.',
        variant: 'destructive',
      });
    },
  });

  // Update proposal section
  const updateProposalMutation = useMutation({
    mutationFn: async ({ proposalId, section, content }: {
      proposalId: string;
      section: string;
      content: string;
    }) => {
      const response = await fetch(`/api/proposals/${proposalId}/section`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, content }),
      });
      if (!response.ok) {
        throw new Error('Failed to update proposal');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Section Updated',
        description: 'Proposal section updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals/rfp', rfpId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error?.message || 'Failed to update section.',
        variant: 'destructive',
      });
    },
  });

  return {
    proposals,
    isLoading,
    error,
    deleteProposal: deleteProposalMutation.mutate,
    updateProposal: updateProposalMutation.mutate,
    isDeleting: deleteProposalMutation.isPending,
    isUpdating: updateProposalMutation.isPending,
  };
}
