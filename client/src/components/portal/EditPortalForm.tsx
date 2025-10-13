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
import type { Portal, PortalFormData } from './types';

interface EditPortalFormProps {
  portal: Portal;
  onSubmit: (data: Partial<PortalFormData>) => void | Promise<void>;
  isLoading?: boolean;
}

export function EditPortalForm({
  portal,
  onSubmit,
  isLoading = false,
}: EditPortalFormProps) {
  const form = useForm<PortalFormData>({
    resolver: zodResolver(insertPortalSchema),
    defaultValues: {
      name: portal.name,
      url: portal.url,
      loginRequired: !!portal.username,
      username: portal.username || '',
      password: portal.password || '',
      status: portal.status || 'active',
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        data-testid="edit-portal-form"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Portal Name</FormLabel>
              <FormControl>
                <Input {...field} data-testid="edit-portal-name" />
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
                <Input {...field} data-testid="edit-portal-url" />
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
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="edit-login-required"
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
                      data-testid="edit-portal-username"
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
                      data-testid="edit-portal-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="submit"
            data-testid="update-portal-button"
            disabled={isLoading}
          >
            <i className="fas fa-save mr-2"></i>
            {isLoading ? 'Updating...' : 'Update Portal'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
