import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, ChevronDown, ChevronUp, Save, RotateCcw } from 'lucide-react';
import type { CompanyAgentConfig } from '@shared/api/agentTracking';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { PrioritySlider } from '../agents/PrioritySlider';
import { cn } from '@/lib/utils';

interface AgentSettingCardProps {
  companyId: string;
  config: CompanyAgentConfig;
}

const getTierColor = (tier: string): string => {
  switch (tier.toLowerCase()) {
    case 'orchestrator':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400';
    case 'manager':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400';
    case 'specialist':
      return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-400';
  }
};

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

export function AgentSettingCard({ companyId, config }: AgentSettingCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Local state for tracking changes
  const [localIsEnabled, setLocalIsEnabled] = React.useState(config.isEnabled);
  const [localPriority, setLocalPriority] = React.useState(config.priority);
  const [localCustomPrompt, setLocalCustomPrompt] = React.useState(
    config.customPrompt || ''
  );

  // Track if there are unsaved changes
  const hasChanges =
    localIsEnabled !== config.isEnabled ||
    localPriority !== config.priority ||
    (config.supportsCustomPrompt &&
      localCustomPrompt !== (config.customPrompt || ''));

  // Save changes mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/company/${companyId}/agent-settings/${config.agentId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isEnabled: localIsEnabled,
            priority: localPriority,
            customPrompt: config.supportsCustomPrompt
              ? localCustomPrompt || null
              : null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save agent settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['company-agent-settings', companyId],
      });
      toast({
        title: 'Settings saved',
        description: `Agent settings for ${config.displayName} have been updated.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Reset to defaults mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/company/${companyId}/agent-settings/${config.agentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset agent settings');
      }

      return response.json();
    },
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ['company-agent-settings', companyId],
      });
      // Update local state to match defaults
      setLocalIsEnabled(data.config.isEnabled);
      setLocalPriority(data.config.priority);
      setLocalCustomPrompt(data.config.customPrompt || '');
      toast({
        title: 'Settings reset',
        description: `Agent settings for ${config.displayName} have been reset to defaults.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error resetting settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleReset = () => {
    resetMutation.mutate();
  };

  return (
    <Card className={cn('transition-all', isExpanded && 'shadow-md')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <Bot
              className={cn('h-5 w-5 mt-1', getTierIconColor(config.tier))}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <CardTitle className="text-base font-semibold">
                  {config.displayName}
                </CardTitle>
                <Badge className={getTierColor(config.tier)} variant="outline">
                  {config.tier}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {config.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Switch
              checked={localIsEnabled}
              onCheckedChange={setLocalIsEnabled}
              aria-label={`Enable ${config.displayName}`}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Collapse settings' : 'Expand settings'}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-2 border-t">
          {/* Priority Slider */}
          <div className="space-y-2">
            <PrioritySlider
              value={localPriority}
              onChange={setLocalPriority}
              disabled={!localIsEnabled}
            />
          </div>

          {/* Custom Instructions */}
          {config.supportsCustomPrompt && (
            <div className="space-y-2">
              <Label htmlFor={`custom-prompt-${config.agentId}`}>
                Custom Instructions
              </Label>
              <Textarea
                id={`custom-prompt-${config.agentId}`}
                value={localCustomPrompt}
                onChange={e => setLocalCustomPrompt(e.target.value)}
                placeholder="Add custom instructions for this agent (optional)"
                className="min-h-[100px] resize-y"
                disabled={!localIsEnabled}
              />
              <p className="text-xs text-muted-foreground">
                Customize how this agent behaves for this company profile.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              size="sm"
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
            {config.hasCustomization && (
              <Button
                onClick={handleReset}
                disabled={resetMutation.isPending}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {resetMutation.isPending ? 'Resetting...' : 'Reset to Defaults'}
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
