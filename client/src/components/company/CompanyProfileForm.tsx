import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCompanyProfileSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CompanyProfile, CompanyProfileFormData } from "./types";

interface CompanyProfileFormProps {
  profile?: CompanyProfile;
  onSuccess: () => void;
}

export function CompanyProfileForm({ profile, onSuccess }: CompanyProfileFormProps) {
  const { toast } = useToast();

  const form = useForm<CompanyProfileFormData>({
    resolver: zodResolver(insertCompanyProfileSchema),
    defaultValues: {
      companyName: profile?.companyName || "",
      dba: profile?.dba || "",
      website: profile?.website || "",
      primaryBusinessCategory: profile?.primaryBusinessCategory || "",
      naicsPrimary: profile?.naicsPrimary || "",
      nigpCodes: profile?.nigpCodes || "",
      employeesCount: profile?.employeesCount || "",
      registrationState: profile?.registrationState || "",
      county: profile?.county || "",
      isActive: profile?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CompanyProfileFormData) =>
      apiRequest("POST", "/api/company-profiles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profiles"] });
      toast({ title: "Company profile created successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to create company profile", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CompanyProfileFormData) =>
      apiRequest("PUT", `/api/company-profiles/${profile!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profiles"] });
      toast({ title: "Company profile updated successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to update company profile", variant: "destructive" });
    },
  });

  const onSubmit = (data: CompanyProfileFormData) => {
    if (profile) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-company-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dba"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DBA (Doing Business As)</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} data-testid="input-dba" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="primaryBusinessCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Business Category</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} data-testid="input-business-category" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="https://example.com" data-testid="input-website" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="naicsPrimary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NAICS Primary Code</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} data-testid="input-naics-primary" />
                </FormControl>
                <FormDescription>Primary NAICS industry classification code</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nigpCodes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NIGP Codes</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} data-testid="input-nigp-codes" />
                </FormControl>
                <FormDescription>National Institute of Governmental Purchasing codes</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="employeesCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee Count</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} data-testid="input-employees-count" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="registrationState"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Registration State</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} data-testid="input-registration-state" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="county"
            render={({ field }) => (
              <FormItem>
                <FormLabel>County</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} data-testid="input-county" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-save-profile"
          >
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : profile ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
}