import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListOrdered, Settings, Gauge } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PrioritySlider } from './PrioritySlider';
import { useToast } from '@/hooks/use-toast';
import type {
  AgentQueueItem,
  AgentResourceAllocation,
} from '@shared/api/agentTracking';

interface QueueResponse {
  queues: Record<string, AgentQueueItem[]>;
}

interface ResourceResponse {
  allocations: AgentResourceAllocation[];
}

const getPriorityVariant = (
  priority: number
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (priority >= 9) return 'destructive';
  if (priority >= 7) return 'default';
  if (priority >= 5) return 'secondary';
  return 'outline';
};

const getLoadColor = (load: number): string => {
  if (load >= 90) return 'bg-red-500';
  if (load >= 70) return 'bg-orange-500';
  if (load >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
};

export function AgentQueueManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingQueueItem, setEditingQueueItem] =
    useState<AgentQueueItem | null>(null);
  const [newPriority, setNewPriority] = useState<number>(5);

  // Fetch agent queues
  const {
    data: queueData,
    isLoading: isLoadingQueues,
    error: queuesError,
  } = useQuery<QueueResponse>({
    queryKey: ['/api/agent-queues'],
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  // Fetch agent resources
  const {
    data: resourceData,
    isLoading: isLoadingResources,
    error: resourcesError,
  } = useQuery<ResourceResponse>({
    queryKey: ['/api/agent-resources'],
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  // Mutation for updating priority
  const updatePriorityMutation = useMutation({
    mutationFn: async ({
      queueItemId,
      priority,
    }: {
      queueItemId: string;
      priority: number;
    }) => {
      const response = await fetch(
        `/api/agent-queues/${queueItemId}/priority`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update priority');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent-queues'] });
      toast({
        title: 'Priority Updated',
        description: 'Task priority has been successfully updated.',
      });
      setEditingQueueItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update priority',
        variant: 'destructive',
      });
    },
  });

  const handleOpenPriorityDialog = (item: AgentQueueItem) => {
    setEditingQueueItem(item);
    setNewPriority(item.priority);
  };

  const handleSavePriority = () => {
    if (editingQueueItem) {
      updatePriorityMutation.mutate({
        queueItemId: editingQueueItem.id,
        priority: newPriority,
      });
    }
  };

  if (queuesError || resourcesError) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">
            Error loading agent queues:{' '}
            {(queuesError || resourcesError)?.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isLoading = isLoadingQueues || isLoadingResources;
  const queues = queueData?.queues || {};
  const allocations = resourceData?.allocations || [];

  return (
    <div className="space-y-6">
      {/* Resource Allocation Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Agent Resource Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {allocations.map(allocation => (
                <div
                  key={allocation.agentId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">
                          {allocation.agentDisplayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {allocation.tier} · {allocation.activeTasks}/
                          {allocation.maxConcurrentTasks} active ·{' '}
                          {allocation.queuedTasks} queued
                        </p>
                      </div>
                      <Badge variant="outline">
                        {allocation.currentLoad}% load
                      </Badge>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getLoadColor(allocation.currentLoad)}`}
                        style={{ width: `${allocation.currentLoad}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {allocations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active agents
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Queues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            Agent Task Queues
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {Object.entries(queues).map(([agentId, items]) => (
                  <div key={agentId} className="space-y-2">
                    <h3 className="font-semibold text-sm text-muted-foreground">
                      {items[0]?.agentDisplayName || agentId} (
                      {items.length} tasks)
                    </h3>
                    <div className="space-y-2">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">#{item.position}</Badge>
                              <p className="font-medium text-sm">
                                {item.rfpTitle}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.estimatedStartTime ? (
                                <>
                                  Est. start:{' '}
                                  {new Date(
                                    item.estimatedStartTime
                                  ).toLocaleString()}
                                </>
                              ) : (
                                'Waiting in queue'
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getPriorityVariant(item.priority)}>
                              Priority {item.priority}
                            </Badge>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleOpenPriorityDialog(item)
                                  }
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    Adjust Task Priority
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 pt-4">
                                  <div>
                                    <p className="font-medium mb-1">
                                      {editingQueueItem?.rfpTitle}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Agent:{' '}
                                      {editingQueueItem?.agentDisplayName}
                                    </p>
                                  </div>
                                  <PrioritySlider
                                    value={newPriority}
                                    onChange={setNewPriority}
                                    disabled={updatePriorityMutation.isPending}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => setEditingQueueItem(null)}
                                      disabled={
                                        updatePriorityMutation.isPending
                                      }
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={handleSavePriority}
                                      disabled={
                                        updatePriorityMutation.isPending
                                      }
                                    >
                                      {updatePriorityMutation.isPending
                                        ? 'Saving...'
                                        : 'Save'}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {Object.keys(queues).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No queued tasks
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
