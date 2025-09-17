import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Building2, MapPin, Users, Shield, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertCompanyProfileSchema } from "@shared/schema";
import type { z } from "zod";

type CompanyProfileFormData = z.infer<typeof insertCompanyProfileSchema>;
type CompanyProfile = {
  id: string;
  companyName: string;
  dba: string | null;
  website: string | null;
  primaryBusinessCategory: string | null;
  naicsPrimary: string | null;
  nigpCodes: string | null;
  employeesCount: string | null;
  registrationState: string | null;
  county: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function CompanyProfileForm({ 
  profile, 
  onSuccess 
}: { 
  profile?: CompanyProfile; 
  onSuccess: () => void; 
}) {
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
                  <Input {...field} data-testid="input-dba" />
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
                  <Input {...field} data-testid="input-business-category" />
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
                  <Input {...field} placeholder="https://example.com" data-testid="input-website" />
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
                  <Input {...field} data-testid="input-naics-primary" />
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
                  <Input {...field} data-testid="input-nigp-codes" />
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
                  <Input {...field} data-testid="input-employees-count" />
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
                  <Input {...field} data-testid="input-registration-state" />
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
                  <Input {...field} data-testid="input-county" />
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

function CompanyProfileCard({ profile }: { profile: CompanyProfile }) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  return (
    <Card className="transition-shadow hover:shadow-md" data-testid={`card-profile-${profile.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid={`text-profile-name-${profile.id}`}>
              <Building2 className="w-5 h-5" />
              {profile.companyName}
            </CardTitle>
            <CardDescription>{profile.primaryBusinessCategory || "Business Category Not Specified"}</CardDescription>
            {profile.dba && (
              <CardDescription className="text-xs">DBA: {profile.dba}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={profile.isActive ? "default" : "secondary"}>
              {profile.isActive ? "Active" : "Inactive"}
            </Badge>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-edit-${profile.id}`}>
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Company Profile</DialogTitle>
                  <DialogDescription>
                    Update company information and details
                  </DialogDescription>
                </DialogHeader>
                <CompanyProfileForm 
                  profile={profile} 
                  onSuccess={() => setEditDialogOpen(false)} 
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">NAICS Primary:</span>
            <p className="text-muted-foreground">{profile.naicsPrimary || "Not provided"}</p>
          </div>
          <div>
            <span className="font-medium">Registration State:</span>
            <p className="text-muted-foreground">{profile.registrationState || "Not provided"}</p>
          </div>
          <div>
            <span className="font-medium">County:</span>
            <p className="text-muted-foreground">{profile.county || "Not provided"}</p>
          </div>
          <div>
            <span className="font-medium">Employees:</span>
            <p className="text-muted-foreground">{profile.employeesCount || "Not provided"}</p>
          </div>
        </div>
        
        {profile.nigpCodes && (
          <div>
            <span className="font-medium text-sm">NIGP Codes:</span>
            <p className="text-sm text-muted-foreground">{profile.nigpCodes}</p>
          </div>
        )}
        
        {profile.website && (
          <div>
            <span className="font-medium text-sm">Website:</span>
            <a 
              href={profile.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline ml-2"
              data-testid={`link-website-${profile.id}`}
            >
              {profile.website}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CompanyProfiles() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isExpiringDialogOpen, setIsExpiringDialogOpen] = useState(false);
  const [expiringDialogType, setExpiringDialogType] = useState<"certifications" | "insurance" | "all">("all");
  
  const { data: profiles, isLoading } = useQuery({
    queryKey: ["/api/company-profiles"],
  });

  const { data: expiringCertifications } = useQuery({
    queryKey: ["/api/certifications/expiring"],
  });

  const { data: expiringInsurance } = useQuery({
    queryKey: ["/api/insurance/expiring"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Company Profiles</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasExpiringItems = (expiringCertifications?.length || 0) > 0 || (expiringInsurance?.length || 0) > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Profiles</h1>
          <p className="text-muted-foreground">Manage your company information and credentials</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-profile">
              <Plus className="w-4 h-4 mr-2" />
              Add Company Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Company Profile</DialogTitle>
              <DialogDescription>
                Add a new company profile to manage RFP proposals
              </DialogDescription>
            </DialogHeader>
            <CompanyProfileForm onSuccess={() => setCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {hasExpiringItems && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="w-5 h-5" />
              Expiring Items Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(expiringCertifications?.length || 0) > 0 && (
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {expiringCertifications?.length} certification(s) expiring soon
                </p>
              )}
              {(expiringInsurance?.length || 0) > 0 && (
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {expiringInsurance?.length} insurance policy(ies) expiring soon
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="profiles" className="w-full">
        <TabsList>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <Building2 className="w-4 h-4 mr-2" />
            Profiles ({profiles?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-6">
          {profiles?.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Company Profiles</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first company profile to start managing RFP proposals
                </p>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-first-profile">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Profile
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles?.map((profile: CompanyProfile) => (
                <CompanyProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Profiles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-profiles">
                  {profiles?.length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Profiles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {profiles?.filter((p: CompanyProfile) => p.isActive).length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer hover:bg-muted/50 transition-colors" 
              onClick={() => {
                setExpiringDialogType("certifications");
                setIsExpiringDialogOpen(true);
              }}
              data-testid="card-expiring-certifications"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Expiring Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600" data-testid="stat-expiring-certifications">
                  {expiringCertifications?.length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer hover:bg-muted/50 transition-colors" 
              onClick={() => {
                setExpiringDialogType("insurance");
                setIsExpiringDialogOpen(true);
              }}
              data-testid="card-expiring-insurance"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Expiring Insurance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600" data-testid="stat-expiring-insurance">
                  {expiringInsurance?.length || 0}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Expiring Items Dialog */}
      <Dialog open={isExpiringDialogOpen} onOpenChange={setIsExpiringDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Expiring Items Alert
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Expiring Certifications */}
            {(expiringDialogType === "certifications" || expiringDialogType === "all") && 
             expiringCertifications && expiringCertifications.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-orange-600">
                  Expiring Certifications ({expiringCertifications.length})
                </h3>
                <div className="space-y-3">
                  {expiringCertifications.map((cert: any) => (
                    <Card key={cert.id} className="border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {cert.certificationType?.toUpperCase() || 'Unknown Certification'}
                            </div>
                            {cert.certificationNumber && (
                              <div className="text-sm text-muted-foreground">
                                Certificate #: {cert.certificationNumber}
                              </div>
                            )}
                            {cert.issuingEntity && (
                              <div className="text-sm text-muted-foreground">
                                Issuing Entity: {cert.issuingEntity}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-orange-600">
                              Expires: {new Date(cert.expirationDate).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {Math.ceil((new Date(cert.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Expiring Insurance */}
            {(expiringDialogType === "insurance" || expiringDialogType === "all") && 
             expiringInsurance && expiringInsurance.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-orange-600">
                  Expiring Insurance ({expiringInsurance.length})
                </h3>
                <div className="space-y-3">
                  {expiringInsurance.map((insurance: any) => (
                    <Card key={insurance.id} className="border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {insurance.insuranceType?.replace('_', ' ').toUpperCase() || 'Unknown Insurance'}
                            </div>
                            {insurance.policyNumber && (
                              <div className="text-sm text-muted-foreground">
                                Policy #: {insurance.policyNumber}
                              </div>
                            )}
                            {insurance.carrier && (
                              <div className="text-sm text-muted-foreground">
                                Carrier: {insurance.carrier}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-orange-600">
                              Expires: {new Date(insurance.expirationDate).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {Math.ceil((new Date(insurance.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* No expiring items */}
            {(
              (expiringDialogType === "certifications" && (!expiringCertifications || expiringCertifications.length === 0)) ||
              (expiringDialogType === "insurance" && (!expiringInsurance || expiringInsurance.length === 0)) ||
              (expiringDialogType === "all" && (!expiringCertifications || expiringCertifications.length === 0) && (!expiringInsurance || expiringInsurance.length === 0))
            ) && (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 text-green-600" />
                <p>No {expiringDialogType === "all" ? "items" : expiringDialogType} expiring in the next 90 days</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}