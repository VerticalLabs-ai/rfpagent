import {
  Clock,
  DollarSign,
  Building,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { RFPOverviewProps } from './types';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getDaysUntilDeadline = (deadline: string | Date | null | undefined) => {
  if (!deadline) return 0;
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export function RFPOverview({ rfp }: RFPOverviewProps) {
  return (
    <Card data-testid="card-overview">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rfp.description && (
          <div>
            <h3 className="font-medium mb-2">Description</h3>
            <p className="text-muted-foreground" data-testid="text-description">
              {rfp.description}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rfp.deadline && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Deadline</p>
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="text-deadline"
                >
                  {formatDate(rfp.deadline)}
                </p>
                {(() => {
                  const days = getDaysUntilDeadline(rfp.deadline);
                  return (
                    <p
                      className={`text-xs ${days <= 7 ? 'text-red-600' : days <= 30 ? 'text-yellow-600' : 'text-green-600'}`}
                    >
                      {days > 0
                        ? `${days} days remaining`
                        : `${Math.abs(days)} days overdue`}
                    </p>
                  );
                })()}
              </div>
            </div>
          )}

          {rfp.estimatedValue && (
            <div className="flex items-center gap-3">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Estimated Value</p>
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="text-estimated-value"
                >
                  {formatCurrency(parseFloat(rfp.estimatedValue))}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Building className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Agency</p>
              <p
                className="text-sm text-muted-foreground"
                data-testid="text-agency"
              >
                {rfp.agency}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Progress</p>
              <div className="flex items-center gap-2">
                <Progress value={rfp.progress || 0} className="w-20" />
                <span
                  className="text-sm text-muted-foreground"
                  data-testid="text-progress"
                >
                  {rfp.progress || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional RFP Details */}
        {!!rfp.requirements &&
          typeof rfp.requirements === 'object' &&
          !Array.isArray(rfp.requirements) && (
            <div className="border-t pt-4 space-y-4">
              {(rfp.requirements as any)?.solicitation_number && (
                <div>
                  <p className="text-sm font-medium mb-1">
                    Solicitation Number
                  </p>
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-solicitation-number"
                  >
                    {(rfp.requirements as any).solicitation_number}
                  </p>
                </div>
              )}

              {(rfp.requirements as any)?.contact && (
                <div>
                  <p className="text-sm font-medium mb-1">
                    Contact Information
                  </p>
                  <div className="space-y-1" data-testid="text-contact-info">
                    {(rfp.requirements as any).contact.name && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Name:</span>{' '}
                        {(rfp.requirements as any).contact.name}
                      </p>
                    )}
                    {(rfp.requirements as any).contact.email && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Email:</span>{' '}
                        {(rfp.requirements as any).contact.email}
                      </p>
                    )}
                    {(rfp.requirements as any).contact.phone && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Phone:</span>{' '}
                        {(rfp.requirements as any).contact.phone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(rfp.requirements as any).pre_bid_meeting && (
                <div>
                  <p className="text-sm font-medium mb-1">Pre-bid Meeting</p>
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-pre-bid-meeting"
                  >
                    {(rfp.requirements as any).pre_bid_meeting}
                  </p>
                </div>
              )}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
