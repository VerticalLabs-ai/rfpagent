import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  X,
  Bot,
  User,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await apiRequest('GET', url);
  return (await response.json()) as T;
};

interface SuspendedWorkflow {
  id: string;
  workflowId: string;
  conversationId?: string;
  currentPhase: string;
  status: string;
  progress: number;
  context: Record<string, unknown> | null;
  suspensionReason: string;
  suspensionData: Record<string, unknown> | null;
  resumeInstructions: string;
  createdAt: string;
  updatedAt: string;
}

interface HumanInputData {
  searchCriteria?: string;
  selectedRfps?: string[];
  requirements?: string;
  changes?: string;
  customInput?: string;
  [key: string]: unknown;
}

interface HumanInputForm {
  action: string;
  data: HumanInputData;
}

interface ResumeWorkflowInput {
  workflowId: string;
  humanInput: HumanInputForm;
}

export default function WorkflowManagement() {
  const [selectedWorkflow, setSelectedWorkflow] =
    useState<SuspendedWorkflow | null>(null);
  const [humanInput, setHumanInput] = useState<HumanInputForm>({
    action: '',
    data: {},
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for suspended workflows
  const {
    data: suspendedWorkflows = [],
    isLoading,
    refetch,
  } = useQuery<SuspendedWorkflow[]>({
    queryKey: ['/api/workflows/suspended'],
    queryFn: () => fetchJson<SuspendedWorkflow[]>('/api/workflows/suspended'),
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Resume workflow mutation
  const resumeWorkflowMutation = useMutation({
    mutationFn: async ({
      workflowId,
      humanInput: input,
    }: ResumeWorkflowInput) => {
      return apiRequest('POST', `/api/workflows/${workflowId}/resume`, {
        humanInput: input,
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Workflow Resumed',
        description: `Workflow ${variables.workflowId} has been resumed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows/suspended'] });
      setSelectedWorkflow(null);
      setHumanInput({ action: '', data: {} });
    },
    onError: error => {
      toast({
        title: 'Resume Failed',
        description:
          error instanceof Error ? error.message : 'Failed to resume workflow',
        variant: 'destructive',
      });
    },
  });

  // Cancel workflow mutation
  const cancelWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest('POST', `/api/workflows/${workflowId}/cancel`);
    },
    onSuccess: (_, workflowId) => {
      toast({
        title: 'Workflow Cancelled',
        description: `Workflow ${workflowId} has been cancelled`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows/suspended'] });
      setSelectedWorkflow(null);
    },
    onError: error => {
      toast({
        title: 'Cancel Failed',
        description:
          error instanceof Error ? error.message : 'Failed to cancel workflow',
        variant: 'destructive',
      });
    },
  });

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'discovery':
        return <Bot className="h-4 w-4" />;
      case 'analysis':
        return <CheckCircle className="h-4 w-4" />;
      case 'generation':
        return <AlertCircle className="h-4 w-4" />;
      case 'submission':
        return <Play className="h-4 w-4" />;
      case 'monitoring':
        return <Clock className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'discovery':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'analysis':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'generation':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'submission':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'monitoring':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const handleResumeWorkflow = () => {
    if (!selectedWorkflow) return;
    resumeWorkflowMutation.mutate({
      workflowId: selectedWorkflow.workflowId,
      humanInput: humanInput,
    });
  };

  const handleCancelWorkflow = () => {
    if (!selectedWorkflow) return;
    cancelWorkflowMutation.mutate(selectedWorkflow.workflowId);
  };

  const renderHumanInputForm = (workflow: SuspendedWorkflow) => {
    const phase = workflow.currentPhase;

    switch (phase) {
      case 'discovery':
        return (
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="search-criteria"
                data-testid="label-search-criteria"
              >
                Search Criteria Override
              </Label>
              <Textarea
                id="search-criteria"
                data-testid="input-search-criteria"
                placeholder="Provide custom search criteria (JSON format)"
                value={humanInput.data.searchCriteria || ''}
                onChange={e =>
                  setHumanInput({
                    action: 'override_search',
                    data: {
                      ...humanInput.data,
                      searchCriteria: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        );

      case 'analysis':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="selected-rfps" data-testid="label-selected-rfps">
                Selected RFPs for Analysis
              </Label>
              <Input
                id="selected-rfps"
                data-testid="input-selected-rfps"
                placeholder="RFP IDs (comma-separated)"
                value={humanInput.data.selectedRfps?.join(',') || ''}
                onChange={e =>
                  setHumanInput({
                    action: 'approve_rfp_selection',
                    data: {
                      ...humanInput.data,
                      selectedRfps: e.target.value.split(',').filter(Boolean),
                    },
                  })
                }
              />
            </div>
          </div>
        );

      case 'generation':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="requirements" data-testid="label-requirements">
                Additional Requirements
              </Label>
              <Textarea
                id="requirements"
                data-testid="input-requirements"
                placeholder="Provide additional requirements or feedback for proposal generation"
                value={humanInput.data.requirements || ''}
                onChange={e =>
                  setHumanInput({
                    action: 'provide_requirements',
                    data: { ...humanInput.data, requirements: e.target.value },
                  })
                }
              />
            </div>
          </div>
        );

      case 'submission':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                data-testid="button-approve-submission"
                onClick={() =>
                  setHumanInput({ action: 'approve_submission', data: {} })
                }
                variant={
                  humanInput.action === 'approve_submission'
                    ? 'default'
                    : 'outline-solid'
                }
              >
                Approve Submission
              </Button>
              <Button
                data-testid="button-request-changes"
                onClick={() =>
                  setHumanInput({ action: 'request_changes', data: {} })
                }
                variant={
                  humanInput.action === 'request_changes'
                    ? 'default'
                    : 'outline-solid'
                }
              >
                Request Changes
              </Button>
            </div>
            {humanInput.action === 'request_changes' && (
              <div>
                <Label htmlFor="changes" data-testid="label-changes">
                  Requested Changes
                </Label>
                <Textarea
                  id="changes"
                  data-testid="input-changes"
                  placeholder="Describe the changes needed"
                  value={humanInput.data.changes || ''}
                  onChange={e =>
                    setHumanInput({
                      action: 'request_changes',
                      data: { ...humanInput.data, changes: e.target.value },
                    })
                  }
                />
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="custom-input" data-testid="label-custom-input">
                Custom Input
              </Label>
              <Textarea
                id="custom-input"
                data-testid="input-custom-input"
                placeholder="Provide custom input for workflow continuation"
                value={humanInput.data.customInput || ''}
                onChange={e =>
                  setHumanInput({
                    action: 'custom_input',
                    data: { ...humanInput.data, customInput: e.target.value },
                  })
                }
              />
            </div>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[400px]"
        data-testid="loading-workflows"
      >
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading suspended workflows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-bold dark:text-gray-100 text-[#ebebeb]"
            data-testid="heading-workflow-management"
          >
            Workflow Management
          </h1>
          <p
            className="dark:text-gray-400 text-[#b5b5b5]"
            data-testid="text-description"
          >
            Manage suspended workflows and provide human input for AI agents
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          data-testid="button-refresh"
        >
          <Clock className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suspended Workflows List */}
        <Card data-testid="card-suspended-workflows">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Suspended Workflows ({suspendedWorkflows.length})
            </CardTitle>
            <CardDescription>
              Workflows waiting for human input or decision
            </CardDescription>
          </CardHeader>
          <CardContent>
            {suspendedWorkflows.length === 0 ? (
              <div className="text-center py-8" data-testid="text-no-workflows">
                <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No suspended workflows</p>
                <p className="text-sm text-gray-400">
                  All workflows are running smoothly!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {suspendedWorkflows.map((workflow: SuspendedWorkflow) => (
                  <Card
                    key={workflow.id}
                    className={`cursor-pointer transition-colors ${
                      selectedWorkflow?.id === workflow.id
                        ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedWorkflow(workflow)}
                    data-testid={`card-workflow-${workflow.workflowId}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getPhaseIcon(workflow.currentPhase)}
                          <span className="font-medium">
                            {workflow.workflowId}
                          </span>
                        </div>
                        <Badge className={getPhaseColor(workflow.currentPhase)}>
                          {workflow.currentPhase}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {workflow.suspensionReason}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Progress: {workflow.progress}%</span>
                        <span>
                          {new Date(workflow.updatedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workflow Details and Actions */}
        <Card data-testid="card-workflow-details">
          <CardHeader>
            <CardTitle>Workflow Details</CardTitle>
            <CardDescription>
              {selectedWorkflow
                ? 'Provide input to continue the workflow'
                : 'Select a suspended workflow to view details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedWorkflow ? (
              <div
                className="text-center py-8"
                data-testid="text-select-workflow"
              >
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">
                  Select a workflow to view details
                </p>
              </div>
            ) : (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details" data-testid="tab-details">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="input" data-testid="tab-input">
                    Human Input
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div data-testid="workflow-details">
                    <h3 className="font-semibold mb-2">Workflow Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">ID:</span>
                        <p className="text-gray-600 dark:text-gray-400">
                          {selectedWorkflow.workflowId}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Phase:</span>
                        <p className="text-gray-600 dark:text-gray-400">
                          {selectedWorkflow.currentPhase}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Progress:</span>
                        <p className="text-gray-600 dark:text-gray-400">
                          {selectedWorkflow.progress}%
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Status:</span>
                        <p className="text-gray-600 dark:text-gray-400">
                          {selectedWorkflow.status}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div>
                      <h4 className="font-medium mb-2">Suspension Reason</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedWorkflow.suspensionReason}
                      </p>
                    </div>

                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Resume Instructions</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedWorkflow.resumeInstructions}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="input" className="space-y-4">
                  <div data-testid="human-input-form">
                    <h3 className="font-semibold mb-4">Provide Human Input</h3>

                    <Alert className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        This workflow is in the{' '}
                        <strong>{selectedWorkflow.currentPhase}</strong> phase
                        and requires human input to continue.
                      </AlertDescription>
                    </Alert>

                    {renderHumanInputForm(selectedWorkflow)}

                    <Separator className="my-6" />

                    <div className="flex gap-2">
                      <Button
                        onClick={handleResumeWorkflow}
                        disabled={
                          resumeWorkflowMutation.isPending || !humanInput.action
                        }
                        className="flex-1"
                        data-testid="button-resume-workflow"
                      >
                        {resumeWorkflowMutation.isPending ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Resuming...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Resume Workflow
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleCancelWorkflow}
                        disabled={cancelWorkflowMutation.isPending}
                        variant="destructive"
                        data-testid="button-cancel-workflow"
                      >
                        {cancelWorkflowMutation.isPending ? (
                          <Clock className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
