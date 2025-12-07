import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Check, Edit2 } from 'lucide-react';
import { useWizard } from '../context';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ProposalRow } from '@shared/schema';

export function PreviewEditStep() {
  const { state, dispatch } = useWizard();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Fetch the generated proposal
  const { data: proposal, isLoading } = useQuery<ProposalRow>({
    queryKey: ['/api/proposals/rfp', state.rfpId],
    enabled: !!state.rfpId,
  });

  const proposalContent = proposal?.content
    ? typeof proposal.content === 'string'
      ? JSON.parse(proposal.content)
      : proposal.content
    : {};

  // Regenerate section mutation
  const regenerateMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const section = state.sections.find(s => s.id === sectionId);
      return apiRequest('POST', '/api/proposals/wizard/regenerate-section', {
        proposalId: proposal?.id,
        sectionId,
        userNotes: section?.userNotes || '',
        qualityLevel: 'standard',
      }) as Promise<{ success: boolean; content: string }>;
    },
    onSuccess: (data, sectionId) => {
      dispatch({
        type: 'UPDATE_SECTION_CONTENT',
        payload: { sectionId, content: data.content },
      });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals/rfp', state.rfpId] });
    },
  });

  // Save edit mutation
  const saveEditMutation = useMutation({
    mutationFn: async ({ sectionId, content }: { sectionId: string; content: string }) => {
      const updatedContent = { ...proposalContent, [sectionId]: content };
      return apiRequest('PUT', `/api/proposals/${proposal?.id}`, {
        content: JSON.stringify(updatedContent),
      });
    },
    onSuccess: () => {
      setEditingSection(null);
      queryClient.invalidateQueries({ queryKey: ['/api/proposals/rfp', state.rfpId] });
    },
  });

  const handleStartEdit = (sectionId: string) => {
    setEditingSection(sectionId);
    setEditContent(proposalContent[sectionId] || '');
  };

  const handleSaveEdit = () => {
    if (editingSection) {
      saveEditMutation.mutate({ sectionId: editingSection, content: editContent });
    }
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditContent('');
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Preview & Edit Proposal</h2>
          <p className="text-muted-foreground text-sm">
            Review each section and make edits as needed
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {Object.keys(proposalContent).length} sections
        </Badge>
      </div>

      <Tabs defaultValue={state.sections[0]?.id} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 p-1">
          {state.sections.map(section => (
            <TabsTrigger key={section.id} value={section.id} className="text-xs">
              {section.displayName}
            </TabsTrigger>
          ))}
        </TabsList>

        {state.sections.map(section => (
          <TabsContent key={section.id} value={section.id} className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{section.displayName}</CardTitle>
                  <div className="flex gap-2">
                    {editingSection === section.id ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={saveEditMutation.isPending}
                        >
                          {saveEditMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => regenerateMutation.mutate(section.id)}
                          disabled={regenerateMutation.isPending}
                        >
                          {regenerateMutation.isPending &&
                          regenerateMutation.variables === section.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          Regenerate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(section.id)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editingSection === section.id ? (
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                  />
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {proposalContent[section.id] || 'No content generated for this section.'}
                      </pre>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
