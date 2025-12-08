import React, { useState, useEffect } from 'react';
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

export function AgentWorkPanel({ rfpId, showCompleted = true }: AgentWorkPanelProps) {
  const [sessions, setSessions] = useState<AgentWorkSession[]>([]);

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

  // Set up SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource(`/api/agent-work/stream`);

    // The server sends generic data messages with a type property
    // We need to use onmessage to receive them
    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, payload } = message;

        switch (type) {
          case 'init':
            // Initial state from server
            if (payload?.activeSessions) {
              const rfpSessions = payload.activeSessions.filter(
                (s: AgentWorkSession) => s.rfpId === rfpId
              );
              if (rfpSessions.length > 0) {
                setSessions(rfpSessions);
              }
            }
            break;

          case 'agent:work_started':
            if (payload?.rfpId === rfpId) {
              setSessions((prev) => {
                const exists = prev.some((s) => s.sessionId === payload.sessionId);
                if (exists) return prev;
                return [payload, ...prev];
              });
            }
            break;

          case 'agent:progress_update':
            setSessions((prev) =>
              prev.map((session) =>
                session.sessionId === payload.sessionId
                  ? { ...session, progress: payload.progress, currentStep: payload.currentStep }
                  : session
              )
            );
            break;

          case 'agent:work_completed':
            setSessions((prev) =>
              prev.map((session) =>
                session.sessionId === payload.sessionId
                  ? { ...session, status: 'completed' as const, progress: 100, completedAt: new Date().toISOString() }
                  : session
              )
            );
            break;

          case 'agent:work_failed':
            setSessions((prev) =>
              prev.map((session) =>
                session.sessionId === payload.sessionId
                  ? { ...session, status: 'failed' as const, error: payload.error }
                  : session
              )
            );
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
  }, [rfpId]);

  // Merge API data with realtime updates
  useEffect(() => {
    if (data) {
      setSessions((prev) => {
        const allSessions = [...data.activeSessions, ...(showCompleted ? data.completedSessions : [])];
        // Merge with existing sessions, preferring realtime updates
        const merged = allSessions.map((apiSession) => {
          const realtimeSession = prev.find((s) => s.sessionId === apiSession.sessionId);
          return realtimeSession || apiSession;
        });
        // Add any sessions from realtime that aren't in API response yet
        const newSessions = prev.filter((s) => !allSessions.some((api) => api.sessionId === s.sessionId));
        return [...merged, ...newSessions];
      });
    }
  }, [data, showCompleted]);

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
          <p className="text-sm text-muted-foreground text-center py-8">Failed to load agent activity</p>
        </CardContent>
      </Card>
    );
  }

  // Separate active and completed sessions
  const activeSessions = sessions.filter((s) => s.status === 'in_progress' || s.status === 'queued');
  const completedSessions = sessions.filter((s) => s.status === 'completed' || s.status === 'failed');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Agent Activity</CardTitle>
          <div className="flex items-center gap-2">
            {activeSessions.length > 0 && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                {activeSessions.length} active
              </Badge>
            )}
            {data?.totalAgentsAssigned && data.totalAgentsAssigned > 0 && (
              <Badge variant="outline">{data.totalAgentsAssigned} total agents</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No agents have worked on this RFP yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {/* Active Sessions */}
              {activeSessions.length > 0 && (
                <div className="space-y-2">
                  {activeSessions.map((session) => (
                    <AgentSessionCard key={session.sessionId} session={session} />
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
                  {completedSessions.map((session) => (
                    <AgentSessionCard key={session.sessionId} session={session} compact />
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
