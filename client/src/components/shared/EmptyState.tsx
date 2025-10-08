import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    children?: ReactNode;
  };
  testId?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  testId,
  className = 'p-12 text-center',
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className={className}>
        <i className={`${icon} text-4xl text-muted-foreground mb-4`}></i>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>
        {action &&
          (action.children ? (
            action.children
          ) : (
            <Button onClick={action.onClick} data-testid={testId}>
              <i className="fas fa-plus mr-2"></i>
              {action.label}
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}
