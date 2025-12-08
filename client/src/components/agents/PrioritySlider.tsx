import * as React from 'react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface PrioritySliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Lowest',
  2: 'Very Low',
  3: 'Low',
  4: 'Below Normal',
  5: 'Normal',
  6: 'Above Normal',
  7: 'High',
  8: 'Very High',
  9: 'Critical',
  10: 'Urgent',
};

const getPriorityColor = (priority: number): string => {
  if (priority >= 9) return 'text-red-600 dark:text-red-400';
  if (priority >= 7) return 'text-orange-600 dark:text-orange-400';
  if (priority >= 5) return 'text-yellow-600 dark:text-yellow-400';
  if (priority >= 3) return 'text-blue-600 dark:text-blue-400';
  return 'text-gray-600 dark:text-gray-400';
};

const getPriorityBgColor = (priority: number): string => {
  if (priority >= 9) return 'bg-red-100 dark:bg-red-950';
  if (priority >= 7) return 'bg-orange-100 dark:bg-orange-950';
  if (priority >= 5) return 'bg-yellow-100 dark:bg-yellow-950';
  if (priority >= 3) return 'bg-blue-100 dark:bg-blue-950';
  return 'bg-gray-100 dark:bg-gray-950';
};

export function PrioritySlider({
  value,
  onChange,
  disabled = false,
}: PrioritySliderProps) {
  const handleValueChange = (values: number[]) => {
    onChange(values[0]);
  };

  const priorityLabel = PRIORITY_LABELS[value] || 'Unknown';
  const priorityColor = getPriorityColor(value);
  const priorityBgColor = getPriorityBgColor(value);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Priority:
          </span>
          <div
            className={cn(
              'px-3 py-1 rounded-full text-sm font-semibold',
              priorityBgColor,
              priorityColor
            )}
          >
            {value} - {priorityLabel}
          </div>
        </div>
      </div>

      <Slider
        value={[value]}
        onValueChange={handleValueChange}
        min={1}
        max={10}
        step={1}
        disabled={disabled}
        className="w-full"
      />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>1 (Lowest)</span>
        <span>5 (Normal)</span>
        <span>10 (Urgent)</span>
      </div>
    </div>
  );
}
