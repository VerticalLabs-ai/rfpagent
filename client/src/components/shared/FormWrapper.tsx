import { ReactNode } from 'react';
import { Form } from '@/components/ui/form';
import { ActionButtons } from './ActionButtons';

interface FormAction {
  label: string;
  type?: 'submit' | 'button';
  variant?:
    | 'default'
    | 'destructive'
    | 'outline-solid'
    | 'secondary'
    | 'ghost'
    | 'link';
  icon?: string;
  onClick?: () => void;
  loading?: boolean;
  testId?: string;
}

interface FormWrapperProps {
  form: any; // react-hook-form form object
  onSubmit: (data: any) => void;
  children: ReactNode;
  actions?: FormAction[];
  className?: string;
  testId?: string;
}

export function FormWrapper({
  form,
  onSubmit,
  children,
  actions = [],
  className = 'space-y-6',
  testId,
}: FormWrapperProps) {
  const formActions =
    actions.length > 0
      ? actions
      : [
          {
            label: 'Submit',
            type: 'submit' as const,
            icon: 'fas fa-save',
            testId: 'form-submit',
          },
        ];

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={className}
        data-testid={testId}
      >
        {children}

        <div className="flex justify-end space-x-2 pt-4">
          <ActionButtons
            buttons={formActions.map(action => ({
              ...action,
              disabled: action.loading,
              onClick: action.type === 'submit' ? undefined : action.onClick,
            }))}
          />
        </div>
      </form>
    </Form>
  );
}
