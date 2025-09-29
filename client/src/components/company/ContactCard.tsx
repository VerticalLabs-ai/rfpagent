import { UserCheck, Shield, Users, Mail, Phone, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { NormalizedCompanyContact } from './types';
import { DECISION_AREAS } from './types';

interface ContactCardProps {
  contact: NormalizedCompanyContact;
  onEdit: (contact: NormalizedCompanyContact) => void;
  onDelete: (contactId: string) => void;
}

export function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  const getContactTypeIcon = (type: string) => {
    switch (type) {
      case "owner": return <UserCheck className="w-4 h-4" />;
      case "decision_maker": return <Shield className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getContactTypeBadge = (type: string) => {
    switch (type) {
      case "owner": return <Badge variant="secondary" className="bg-purple-100 text-purple-700">Owner</Badge>;
      case "decision_maker": return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Decision Maker</Badge>;
      default: return <Badge variant="outline">Primary Contact</Badge>;
    }
  };

  return (
    <Card className="transition-shadow hover:shadow-md" data-testid={`card-contact-${contact.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getContactTypeIcon(contact.contactType)}
            <div>
              <CardTitle className="text-base" data-testid={`text-contact-name-${contact.id}`}>
                {contact.name}
              </CardTitle>
              {contact.role && (
                <CardDescription className="text-sm">{contact.role}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getContactTypeBadge(contact.contactType)}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(contact)}
              data-testid={`button-edit-contact-${contact.id}`}
            >
              <Edit className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(contact.id)}
              className="text-red-600 hover:text-red-700"
              data-testid={`button-delete-contact-${contact.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-sm">
          {contact.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3 h-3 text-muted-foreground" />
              <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                {contact.email}
              </a>
            </div>
          )}
          {(contact.officePhone || contact.mobilePhone) && (
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3 text-muted-foreground" />
              <div className="space-x-3">
                {contact.officePhone && (
                  <span>Office: {contact.officePhone}</span>
                )}
                {contact.mobilePhone && (
                  <span>Mobile: {contact.mobilePhone}</span>
                )}
              </div>
            </div>
          )}
          {contact.contactType === "owner" && contact.ownershipPercent && (
            <div className="text-xs text-muted-foreground">
              Ownership: {contact.ownershipPercent}
            </div>
          )}
          {Array.isArray(contact.decisionAreas) && contact.decisionAreas.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">Decision Areas:</div>
              <div className="flex flex-wrap gap-1">
                {contact.decisionAreas.map((area: string) => (
                  <Badge key={area} variant="outline" className="text-xs">
                    {DECISION_AREAS.find(d => d.value === area)?.label || area}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
