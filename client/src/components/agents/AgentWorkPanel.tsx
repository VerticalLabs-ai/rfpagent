import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AgentSessionCard } from './AgentSessionCard';
import type { AgentWorkSession } from '@shared/api/agentTracking';

interface AgentWorkPanelProps {
  rfpId: string;
  showCompleted?: boolean;
}

interface AgentWorkResponse {
  activeSessions: AgentWorkSession[];
  completedSessions: AgentWorkSession[];
  totalAgentsAssigned: number;
}

export function AgentWorkPanel({
  rfpId,
  showCompleted = true,
}: AgentWorkPanelProps) {
  const [realtimeSessions, setRealtimeSessions] = useState<
    Map<string, AgentWorkSession>
  >(new Map());
  const hasInitializedRef = useRef(false);

  // Fetch initial agent work data
  const { data, isLoading, error } = useQuery<AgentWorkResponse>({
    queryKey: ['agent-work', rfpId],
    queryFn: async () => {
      const response = await fetch(`/api/rfps/${rfpId}/agent-work`);
      if (!response.ok) {
        throw new Error('Failed to fetch agent work sessions');
      }
      return response.json();
    },
    refetchInterval: 5000, // Fallback polling every 5 seconds
  });

  // Callback to update sessions from SSE
  const handleSessionUpdate = useCallback(
    (sessionId: string, update: Partial<AgentWorkSession> | null) => {
      setRealtimeSessions(prev => {
        const next = new Map(prev);
        if (update === null) {
          next.delete(sessionId);
        } else {
          const existing = next.get(sessionId);
          next.set(sessionId, { ...existing, ...update } as AgentWorkSession);
        }
        return next;
      });
    },
    []
  );

  // Set up SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource(`/api/agent-work/stream`);

    eventSource.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        const { type, payload } = message;

        switch (type) {
          case 'init':
            if (payload?.activeSessions) {
              const rfpSessions = payload.activeSessions.filter(
                (s: AgentWorkSession) => s.rfpId === rfpId
              );
              rfpSessions.forEach((session: AgentWorkSession) => {
                handleSessionUpdate(session.sessionId, session);
              });
            }
            break;

          case 'agent:work_started':
            if (payload?.rfpId === rfpId) {
              handleSessionUpdate(payload.sessionId, payload);
            }
            break;

          case 'agent:progress_update':
            handleSessionUpdate(payload.sessionId, {
              progress: payload.progress,
              currentStep: payload.currentStep,
            });
            break;

          case 'agent:work_completed':
            handleSessionUpdate(payload.sessionId, {
              status: 'completed' as const,
              progress: 100,
              completedAt: new Date().toISOString(),
            });
            break;

          case 'agent:work_failed':
            handleSessionUpdate(payload.sessionId, {
              status: 'failed' as const,
              error: payload.error,
            });
            break;
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error, will rely on polling fallback');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [rfpId, handleSessionUpdate]);

  // Initialize from API data once - using startTransition to mark as non-urgent update
  useEffect(() => {
    if (data && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      const allSessions = [
        ...(data.activeSessions ?? []),
        ...(showCompleted ? (data.completedSessions ?? []) : []),
      ];
      if (allSessions.length > 0) {
        // Use startTransition to avoid the cascading render warning
        React.startTransition(() => {
          setRealtimeSessions(prev => {
            const next = new Map(prev);
            allSessions.forEach(session => {
              if (!next.has(session.sessionId)) {
                next.set(session.sessionId, session);
              }
            });
            return next;
          });
        });
      }
    }
  }, [data, showCompleted]);

  // Derive merged sessions from API data and realtime updates
  const mergedSessions = React.useMemo(() => {
    if (!data) {
      return Array.from(realtimeSessions.values());
    }

    const allApiSessions = [
      ...(data.activeSessions ?? []),
      ...(showCompleted ? (data.completedSessions ?? []) : []),
    ];

    // Create map of API sessions
    const sessionMap = new Map<string, AgentWorkSession>();
    allApiSessions.forEach(session => {
      sessionMap.set(session.sessionId, session);
    });

    // Override with realtime updates
    realtimeSessions.forEach((session, id) => {
      const apiSession = sessionMap.get(id);
      if (apiSession) {
        sessionMap.set(id, { ...apiSession, ...session });
      } else {
        sessionMap.set(id, session);
      }
    });

    return Array.from(sessionMap.values());
  }, [data, showCompleted, realtimeSessions]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Failed to load agent activity
          </p>
        </CardContent>
      </Card>
    );
  }

  // Separate active and completed sessions from merged data
  const activeSessions = mergedSessions.filter(
    s => s.status === 'in_progress' || s.status === 'queued'
  );
  const completedSessions = mergedSessions.filter(
    s => s.status === 'completed' || s.status === 'failed'
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Agent Activity</CardTitle>
          <div className="flex items-center gap-2">
            {activeSessions.length > 0 && (
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-700 dark:text-blue-400"
              >
                {activeSessions.length} active
              </Badge>
            )}
            {data?.totalAgentsAssigned && data.totalAgentsAssigned > 0 && (
              <Badge variant="outline">
                {data.totalAgentsAssigned} total agents
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mergedSessions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No agents have worked on this RFP yet
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {/* Active Sessions */}
              {activeSessions.length > 0 && (
                <div className="space-y-2">
                  {activeSessions.map(session => (
                    <AgentSessionCard
                      key={session.sessionId}
                      session={session}
                    />
                  ))}
                </div>
              )}

              {/* Completed Sessions */}
              {showCompleted && completedSessions.length > 0 && (
                <div className="space-y-2">
                  {activeSessions.length > 0 && (
                    <div className="pt-3 pb-1 border-t">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Completed ({completedSessions.length})
                      </h4>
                    </div>
                  )}
                  {completedSessions.map(session => (
                    <AgentSessionCard
                      key={session.sessionId}
                      session={session}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
