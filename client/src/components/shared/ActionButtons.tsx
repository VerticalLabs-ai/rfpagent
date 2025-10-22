import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ActionButton {
  label: string;
  icon?: string;
  variant?:
    | 'default'
    | 'destructive'
    | 'outline-solid'
    | 'secondary'
    | 'ghost'
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  testId?: string;
  children?: ReactNode;
}

interface ActionButtonsProps {
  buttons: ActionButton[];
  alignment?: 'left' | 'right' | 'center' | 'between';
  spacing?: 'tight' | 'normal' | 'loose';
  className?: string;
}

export function ActionButtons({
  buttons,
  alignment = 'right',
  spacing = 'normal',
  className = '',
}: ActionButtonsProps) {
  const getAlignmentClass = () => {
    switch (alignment) {
      case 'left':
        return 'justify-start';
      case 'center':
        return 'justify-center';
      case 'between':
        return 'justify-between';
      default:
        return 'justify-end';
    }
  };

  const getSpacingClass = () => {
    switch (spacing) {
      case 'tight':
        return 'space-x-1';
      case 'loose':
        return 'space-x-4';
      default:
        return 'space-x-2';
    }
  };

  return (
    <div
      className={`flex ${getAlignmentClass()} ${getSpacingClass()} ${className}`}
    >
      {buttons.map((button, index) => (
        <Button
          key={index}
          variant={button.variant || 'default'}
          size={button.size || 'default'}
          onClick={button.onClick}
          disabled={button.disabled || button.loading}
          data-testid={button.testId}
        >
          {button.loading ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2"></i>
              {button.label}
            </>
          ) : (
            <>
              {button.icon && <i className={`${button.icon} mr-2`}></i>}
              {button.label}
            </>
          )}
          {button.children}
        </Button>
      ))}
    </div>
  );
}
