import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Settings } from 'lucide-react';
import type { CompanyAgentConfig } from '@shared/api/agentTracking';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentSettingCard } from './AgentSettingCard';
import { cn } from '@/lib/utils';

interface AgentSettingsPanelProps {
  companyId: string;
}

const getTierIconColor = (tier: string): string => {
  switch (tier.toLowerCase()) {
    case 'orchestrator':
      return 'text-purple-600 dark:text-purple-400';
    case 'manager':
      return 'text-blue-600 dark:text-blue-400';
    case 'specialist':
      return 'text-green-600 dark:text-green-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

export function AgentSettingsPanel({ companyId }: AgentSettingsPanelProps) {
  // Fetch agent settings for this company
  const { data, isLoading, error } = useQuery({
    queryKey: ['company-agent-settings', companyId],
    queryFn: async () => {
      const response = await fetch(`/api/company/${companyId}/agent-settings`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch agent settings');
      }

      return response.json() as Promise<{ settings: CompanyAgentConfig[] }>;
    },
  });

  // Group agents by tier
  const groupedAgents = React.useMemo(() => {
    if (!data?.settings) return { managers: [], specialists: [] };

    const managers = data.settings.filter(
      config => config.tier.toLowerCase() === 'manager'
    );
    const specialists = data.settings.filter(
      config => config.tier.toLowerCase() === 'specialist'
    );

    return { managers, specialists };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <CardTitle>Agent Settings</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Customize AI agent behavior for this company profile. Enable/disable
          agents, adjust priorities, and add custom instructions.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : 'Failed to load agent settings'}
            </p>
          </div>
        )}

        {data && (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {/* Manager Agents Section */}
              {groupedAgents.managers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Bot
                      className={cn('h-4 w-4', getTierIconColor('manager'))}
                    />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Manager Agents
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {groupedAgents.managers.map(config => (
                      <AgentSettingCard
                        key={config.agentId}
                        companyId={companyId}
                        config={config}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Specialist Agents Section */}
              {groupedAgents.specialists.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Bot
                      className={cn('h-4 w-4', getTierIconColor('specialist'))}
                    />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Specialist Agents
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {groupedAgents.specialists.map(config => (
                      <AgentSettingCard
                        key={config.agentId}
                        companyId={companyId}
                        config={config}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groupedAgents.managers.length === 0 &&
                groupedAgents.specialists.length === 0 && (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No customizable agents available
                    </p>
                  </div>
                )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
