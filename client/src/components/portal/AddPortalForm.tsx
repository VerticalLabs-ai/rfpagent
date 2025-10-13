import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertPortalSchema } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { PortalFormData } from './types';

interface AddPortalFormProps {
  onSubmit: (data: PortalFormData) => void;
}

export function AddPortalForm({ onSubmit }: AddPortalFormProps) {
  const form = useForm<PortalFormData>({
    resolver: zodResolver(insertPortalSchema as any),
    defaultValues: {
      name: '',
      url: '',
      loginRequired: false,
      username: '',
      password: '',
      status: 'active',
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        data-testid="add-portal-form"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Portal Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Bonfire Hub"
                  {...field}
                  data-testid="portal-name-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Portal URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://..."
                  {...field}
                  data-testid="portal-url-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="loginRequired"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Requires Login</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Enable if the portal requires authentication
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="login-required-switch"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch('loginRequired') && (
          <>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      data-testid="portal-username-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      value={field.value || ''}
                      data-testid="portal-password-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="submit" data-testid="save-portal-button">
            <i className="fas fa-save mr-2"></i>
            Save Portal
          </Button>
        </div>
      </form>
    </Form>
  );
}
