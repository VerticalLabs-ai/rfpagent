import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, AlertTriangle, Users, Shield, MapPin, FileText, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import {
  CompanyProfileForm,
  CompanyProfileCard,
  ContactList,
  type CompanyProfile,
  type CompanyContact,
  DECISION_AREAS
} from "@/components/company";

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

  // Fetch all contacts to analyze decision makers
  const { data: allContacts = [] } = useQuery({
    queryKey: ["/api/company-profiles/all-contacts"],
    queryFn: async () => {
      if (!profiles?.length) return [];
      const contactPromises = profiles.map((profile: CompanyProfile) =>
        apiRequest("GET", `/api/company-profiles/${profile.id}/contacts`)
      );
      const contactArrays = await Promise.all(contactPromises);
      return contactArrays.flat();
    },
    enabled: !!profiles?.length
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

  // Decision Maker Analytics
  const decisionMakers = allContacts.filter((contact: CompanyContact) =>
    contact.contactType === "decision_maker" || contact.contactType === "owner"
  );

  const decisionAreaCoverage = DECISION_AREAS.map(area => ({
    ...area,
    count: decisionMakers.filter((dm: CompanyContact) =>
      (dm.decisionAreas as string[] || []).includes(area.value)
    ).length
  }));

  const companiesWithDecisionMakers = profiles?.filter((profile: CompanyProfile) =>
    allContacts.some((contact: CompanyContact) =>
      contact.companyProfileId === profile.id &&
      (contact.contactType === "decision_maker" || contact.contactType === "owner")
    )
  ).length || 0;

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
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Users className="w-4 h-4 mr-2" />
            Contacts
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

        <TabsContent value="contacts" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Contact Management</h2>
          </div>

          {profiles?.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Company Profiles</h3>
                <p className="text-muted-foreground mb-4">
                  Create company profiles first to manage contacts
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {profiles?.map((profile: CompanyProfile) => (
                <Card key={profile.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        <CardTitle>{profile.companyName}</CardTitle>
                      </div>
                      <Badge variant={profile.isActive ? "default" : "secondary"}>
                        {profile.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {profile.dba && (
                      <CardDescription>DBA: {profile.dba}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-6">
                    <ContactList companyProfileId={profile.id} />
                  </CardContent>
                </Card>
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Contacts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {allContacts.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Decision Makers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {decisionMakers.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {companiesWithDecisionMakers}/{profiles?.length || 0} companies covered
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Decision Area Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {decisionAreaCoverage.map(area => (
                    <div key={area.value} className="flex items-center justify-between">
                      <span className="text-sm">{area.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{
                              width: `${decisionMakers.length > 0 ? (area.count / decisionMakers.length) * 100 : 0}%`
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {area.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Geographic Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(profiles?.map((p: CompanyProfile) => p.registrationState).filter(Boolean)))
                    .slice(0, 5)
                    .map(state => {
                      const count = profiles?.filter((p: CompanyProfile) => p.registrationState === state).length || 0;
                      return (
                        <div key={state} className="flex items-center justify-between">
                          <span className="text-sm">{state}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{
                                  width: `${profiles?.length ? (count / profiles.length) * 100 : 0}%`
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}