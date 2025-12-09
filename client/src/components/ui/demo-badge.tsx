import { Badge } from '@/components/ui/badge';
import { FlaskConical } from 'lucide-react';

interface DemoBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function DemoBadge({ className = '', size = 'sm' }: DemoBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-sm px-2 py-1';

  return (
    <Badge
      variant="outline"
      className={`bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700 ${sizeClasses} ${className}`}
    >
      <FlaskConical className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1.5'} />
      Demo
    </Badge>
  );
}
