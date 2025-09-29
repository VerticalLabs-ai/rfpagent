import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  AlertTriangle,
  Users,
  Shield,
  MapPin,
  FileText,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import {
  CompanyProfileForm,
  CompanyProfileCard,
  ContactList,
  type CompanyProfile,
  type CompanyContact,
  type CompanyCertification,
  type CompanyInsurance,
  type NormalizedCompanyContact,
} from '@/components/company';
import {
  calculateDecisionAreaCoverage,
  countCompaniesWithDecisionMakers,
  getDecisionMakers,
  normalizeCompanyContact,
} from '@/utils/companyProfiles';

type ExpiringDialogType = 'certifications' | 'insurance' | 'all';

type ExpiringItem =
  | CompanyCertification
  | CompanyInsurance;

type ExpiringListConfig = {
  title: string;
  emptyState: string;
  items: ExpiringItem[];
};

export default function CompanyProfiles() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isExpiringDialogOpen, setIsExpiringDialogOpen] = useState(false);
  const [expiringDialogType, setExpiringDialogType] =
    useState<ExpiringDialogType>('all');

  const {
    data: profiles = [],
    isLoading: isProfilesLoading,
  } = useQuery<CompanyProfile[]>({
    queryKey: ['/api/company/profiles'],
  });

  const { data: expiringCertifications = [] } = useQuery<
    CompanyCertification[]
  >({
    queryKey: ['/api/company/certifications/expiring'],
  });

  const { data: expiringInsurance = [] } = useQuery<CompanyInsurance[]>({
    queryKey: ['/api/company/insurance/expiring'],
  });

  const { data: allContacts = [] } = useQuery<NormalizedCompanyContact[]>({
    queryKey: ['/api/company/profiles', 'all-contacts'],
    queryFn: async () => {
      if (profiles.length === 0) {
        return [];
      }

      const responses = await Promise.all(
        profiles.map(async profile => {
          const response = await apiRequest(
            'GET',
            `/api/company/profiles/${profile.id}/contacts`,
          );
          const contactData = (await response.json()) as CompanyContact[];
          return contactData.map(normalizeCompanyContact);
        }),
      );

      return responses.flat();
    },
    enabled: profiles.length > 0,
  });

  const decisionMakers = useMemo(
    () => getDecisionMakers(allContacts),
    [allContacts],
  );

  const decisionAreaCoverage = useMemo(
    () => calculateDecisionAreaCoverage(decisionMakers),
    [decisionMakers],
  );

  const companiesWithDecisionMakers = useMemo(
    () => countCompaniesWithDecisionMakers(profiles, allContacts),
    [profiles, allContacts],
  );

  const hasExpiringItems =
    expiringCertifications.length > 0 || expiringInsurance.length > 0;

  const expiringItems = useMemo<ExpiringListConfig>(() => {
    switch (expiringDialogType) {
      case 'certifications':
        return {
          title: 'Expiring Certifications',
          emptyState: 'No certifications are expiring soon.',
          items: expiringCertifications,
        };
      case 'insurance':
        return {
          title: 'Expiring Insurance Policies',
          emptyState: 'No insurance policies are expiring soon.',
          items: expiringInsurance,
        };
      default:
        return {
          title: 'Upcoming Expirations',
          emptyState: 'No certifications or insurance policies expiring soon.',
          items: [...expiringCertifications, ...expiringInsurance],
        };
    }
  }, [expiringCertifications, expiringDialogType, expiringInsurance]);

  if (isProfilesLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Company Profiles</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Profiles</h1>
          <p className="text-muted-foreground">
            Manage your company information and credentials
          </p>
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
              {expiringCertifications.length > 0 && (
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {expiringCertifications.length} certification(s) expiring soon
                </p>
              )}
              {expiringInsurance.length > 0 && (
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {expiringInsurance.length} insurance policy(ies) expiring soon
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpiringDialogType('all');
                    setIsExpiringDialogOpen(true);
                  }}
                >
                  View All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpiringDialogType('certifications');
                    setIsExpiringDialogOpen(true);
                  }}
                >
                  Certifications
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpiringDialogType('insurance');
                    setIsExpiringDialogOpen(true);
                  }}
                >
                  Insurance
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="profiles" className="w-full">
        <TabsList>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <Building2 className="w-4 h-4 mr-2" />
            Profiles ({profiles.length})
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
          {profiles.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Company Profiles
                </h3>
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
              {profiles.map(profile => (
                <CompanyProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Contact Management</h2>
          </div>

          {profiles.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Company Profiles
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create company profiles first to manage contacts
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {profiles.map(profile => (
                <Card key={profile.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        <CardTitle>{profile.companyName}</CardTitle>
                      </div>
                      <Badge
                        variant={profile.isActive ? 'default' : 'secondary'}
                      >
                        {profile.isActive ? 'Active' : 'Inactive'}
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
                <div
                  className="text-2xl font-bold"
                  data-testid="stat-total-profiles"
                >
                  {profiles.length}
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
                  {profiles.filter(profile => profile.isActive).length}
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
                  {companiesWithDecisionMakers}/{profiles.length} companies covered
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
                    <div
                      key={area.value}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{area.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{
                              width: `${
                                decisionMakers.length > 0
                                  ? (area.count / decisionMakers.length) * 100
                                  : 0
                              }%`,
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
                  {Array.from(
                    new Set(
                      profiles
                        .map(profile => profile.registrationState)
                        .filter(Boolean),
                    ),
                  )
                    .slice(0, 5)
                    .map(state => {
                      const count = profiles.filter(
                        profile => profile.registrationState === state,
                      ).length;

                      return (
                        <div
                          key={state as string}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm">{state}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{
                                  width: `${
                                    profiles.length
                                      ? (count / profiles.length) * 100
                                      : 0
                                  }%`,
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

      <Dialog open={isExpiringDialogOpen} onOpenChange={setIsExpiringDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{expiringItems.title}</DialogTitle>
            <DialogDescription>
              Review upcoming certification and insurance expirations to stay compliant.
            </DialogDescription>
          </DialogHeader>

          {expiringItems.items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                {expiringItems.emptyState}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {expiringItems.items.map(item => (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span>{'certificationType' in item ? item.certificationType : item.insuranceType}</span>
                      {('expirationDate' in item && item.expirationDate) && (
                        <Badge variant="secondary">
                          Expires {new Date(item.expirationDate).toLocaleDateString()}
                        </Badge>
                      )}
                    </CardTitle>
                    {'issuingEntity' in item && item.issuingEntity && (
                      <CardDescription>Issued by {item.issuingEntity}</CardDescription>
                    )}
                    {'carrier' in item && item.carrier && (
                      <CardDescription>Carrier: {item.carrier}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {'certificationNumber' in item && item.certificationNumber && (
                      <div>Certification #: {item.certificationNumber}</div>
                    )}
                    {'policyNumber' in item && item.policyNumber && (
                      <div>Policy #: {item.policyNumber}</div>
                    )}
                    {'notes' in item && item.notes && <div>Notes: {item.notes}</div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
