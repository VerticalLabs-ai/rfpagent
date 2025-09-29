import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertCompanyContactSchema } from '@shared/schema';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { CompanyContact, CompanyContactFormData, DECISION_AREAS } from './types';

interface CompanyContactFormProps {
  contact?: CompanyContact;
  companyProfileId: string;
  onSuccess: () => void;
}

export function CompanyContactForm({ contact, companyProfileId, onSuccess }: CompanyContactFormProps) {
  const { toast } = useToast();

  const form = useForm<CompanyContactFormData>({
    resolver: zodResolver(insertCompanyContactSchema.extend({
      email: insertCompanyContactSchema.shape.email?.optional().refine(
        (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
        { message: "Please enter a valid email address" }
      ),
    })),
    defaultValues: {
      companyProfileId,
      contactType: contact?.contactType || "primary",
      name: contact?.name || "",
      role: contact?.role || "",
      email: contact?.email || "",
      officePhone: contact?.officePhone || "",
      mobilePhone: contact?.mobilePhone || "",
      fax: contact?.fax || "",
      decisionAreas: contact?.decisionAreas || [],
      ownershipPercent: contact?.ownershipPercent || "",
      gender: contact?.gender || "",
      ethnicity: contact?.ethnicity || "",
      citizenship: contact?.citizenship || "",
      hoursPerWeek: contact?.hoursPerWeek || "",
      isActive: contact?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CompanyContactFormData) =>
      apiRequest('POST', `/api/company/profiles/${companyProfileId}/contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/profiles', companyProfileId, 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/profiles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/profiles', 'all-contacts'] });
      toast({ title: 'Contact created successfully' });
      onSuccess();
    },
    onError: () => {
      toast({ title: 'Failed to create contact', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CompanyContactFormData) =>
      apiRequest('PUT', `/api/company/contacts/${contact!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/profiles', companyProfileId, 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/profiles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/profiles', 'all-contacts'] });
      toast({ title: 'Contact updated successfully' });
      onSuccess();
    },
    onError: () => {
      toast({ title: 'Failed to update contact', variant: 'destructive' });
    },
  });

  const onSubmit = (data: CompanyContactFormData) => {
    if (contact) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const contactType = form.watch("contactType");
  const isOwner = contactType === "owner";
  const isDecisionMaker = contactType === "decision_maker" || contactType === "owner";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Basic Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-contact-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} data-testid="select-contact-type">
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="primary">Primary Contact</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="decision_maker">Decision Maker</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role/Title</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="e.g., CEO, Project Manager" data-testid="input-contact-role" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} type="email" placeholder="email@company.com" data-testid="input-contact-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Phone Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="officePhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Office Phone</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="(555) 123-4567" data-testid="input-contact-office-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mobilePhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile Phone</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="(555) 123-4567" data-testid="input-contact-mobile-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fax</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="(555) 123-4567" data-testid="input-contact-fax" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Decision Areas for Decision Makers */}
        {isDecisionMaker && (
          <FormField
            control={form.control}
            name="decisionAreas"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Decision Areas</FormLabel>
                <FormDescription>
                  Select the areas where this person makes key decisions
                </FormDescription>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {DECISION_AREAS.map((area) => (
                    <label key={area.value} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Array.isArray(field.value) && field.value.includes(area.value)}
                        onChange={(e) => {
                          const currentAreas = Array.isArray(field.value) ? field.value : [];
                          if (e.target.checked) {
                            field.onChange([...currentAreas, area.value]);
                          } else {
                            field.onChange(currentAreas.filter((a: string) => a !== area.value));
                          }
                        }}
                        className="rounded border-gray-300"
                        data-testid={`checkbox-decision-area-${area.value}`}
                      />
                      <span>{area.label}</span>
                    </label>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Owner-specific Fields */}
        {isOwner && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <h4 className="font-semibold">Owner Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ownershipPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ownership Percentage</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="e.g., 100%" data-testid="input-ownership-percent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hoursPerWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours Per Week</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="e.g., 40" data-testid="input-hours-per-week" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""} data-testid="select-gender">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non_binary">Non-Binary</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer Not to Say</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ethnicity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ethnicity</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="e.g., Hispanic/Latino" data-testid="input-ethnicity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="citizenship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Citizenship</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="e.g., US Citizen" data-testid="input-citizenship" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-save-contact"
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : contact ? "Update Contact" : "Create Contact"}
          </Button>
        </div>
      </form>
    </Form>
  );
}