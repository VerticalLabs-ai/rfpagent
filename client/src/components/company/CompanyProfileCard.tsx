import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { CompanyProfileForm } from './CompanyProfileForm';
import type { CompanyProfile } from './types';

interface CompanyProfileCardProps {
  profile: CompanyProfile;
}

export function CompanyProfileCard({ profile }: CompanyProfileCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest('DELETE', `/api/company/profiles/${profile.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/profiles'] });
      toast({ title: 'Company profile deleted successfully' });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Failed to delete company profile',
        variant: 'destructive',
      });
    },
  });

  return (
    <Card
      className="transition-shadow hover:shadow-md"
      data-testid={`card-profile-${profile.id}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle
              className="flex items-center gap-2"
              data-testid={`text-profile-name-${profile.id}`}
            >
              <Building2 className="w-5 h-5" />
              {profile.companyName}
            </CardTitle>
            <CardDescription>
              {profile.primaryBusinessCategory ||
                'Business Category Not Specified'}
            </CardDescription>
            {profile.dba && (
              <CardDescription className="text-xs">
                DBA: {profile.dba}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={profile.isActive ? 'default' : 'secondary'}
              size="sm"
              disabled
              data-testid={`button-status-${profile.id}`}
            >
              {profile.isActive ? 'Active' : 'Inactive'}
            </Button>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`button-edit-${profile.id}`}
                >
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
            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  data-testid={`button-delete-${profile.id}`}
                >
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Company Profile</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{profile.companyName}
                    &quot;? This action cannot be undone. All associated
                    contacts, certifications, and insurance records will also be
                    deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">NAICS Primary:</span>
            <p className="text-muted-foreground">
              {profile.naicsPrimary || 'Not provided'}
            </p>
          </div>
          <div>
            <span className="font-medium">Registration State:</span>
            <p className="text-muted-foreground">
              {profile.registrationState || 'Not provided'}
            </p>
          </div>
          <div>
            <span className="font-medium">County:</span>
            <p className="text-muted-foreground">
              {profile.county || 'Not provided'}
            </p>
          </div>
          <div>
            <span className="font-medium">Employees:</span>
            <p className="text-muted-foreground">
              {profile.employeesCount || 'Not provided'}
            </p>
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
