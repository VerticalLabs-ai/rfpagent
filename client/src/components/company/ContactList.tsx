import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { ContactCard } from './ContactCard';
import { CompanyContactForm } from './CompanyContactForm';
import type { CompanyContact, NormalizedCompanyContact } from './types';
import { normalizeCompanyContact } from '@/utils/companyProfiles';

interface ContactListProps {
  companyProfileId: string;
}

export function ContactList({ companyProfileId }: ContactListProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<NormalizedCompanyContact | undefined>();
  const { toast } = useToast();

  const { data: contacts = [], isLoading } = useQuery<NormalizedCompanyContact[]>({
    queryKey: ['/api/company/profiles', companyProfileId, 'contacts'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/company/profiles/${companyProfileId}/contacts`);
      const data = (await response.json()) as CompanyContact[];
      return data.map(normalizeCompanyContact);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (contactId: string) =>
      apiRequest('DELETE', `/api/company/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/company/profiles', companyProfileId, 'contacts'],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/company/profiles', 'all-contacts'] });
      toast({ title: 'Contact deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete contact', variant: 'destructive' });
    },
  });

  const handleEdit = (contact: NormalizedCompanyContact) => {
    setEditingContact(contact);
    setEditDialogOpen(true);
  };

  const handleDelete = (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteMutation.mutate(contactId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-3 bg-muted rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Contacts ({contacts.length})
        </h3>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-contact">
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
              <DialogDescription>
                Add a new contact person for this company
              </DialogDescription>
            </DialogHeader>
            <CompanyContactForm
              companyProfileId={companyProfileId}
              onSuccess={() => setAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No contacts added yet</p>
          <Button
            variant="outline"
            onClick={() => setAddDialogOpen(true)}
            className="mt-3"
            data-testid="button-add-first-contact"
          >
            Add First Contact
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4" data-testid="contact-list">
          {contacts.map(contact => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Edit Contact Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update contact information and details
            </DialogDescription>
          </DialogHeader>
          {editingContact && (
            <CompanyContactForm
              contact={editingContact}
              companyProfileId={companyProfileId}
              onSuccess={() => {
                setEditDialogOpen(false);
                setEditingContact(undefined);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}