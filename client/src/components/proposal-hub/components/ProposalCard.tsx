import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Eye,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Trophy,
} from 'lucide-react';
import { Proposal } from '../types';

interface ProposalCardProps {
  proposal: Proposal;
  onView: (proposal: Proposal) => void;
  onDelete: (proposalId: string) => void;
  onRegenerate?: (proposalId: string) => void;
  isDeleting?: boolean;
}

export function ProposalCard({
  proposal,
  onView,
  onDelete,
  onRegenerate,
  isDeleting,
}: ProposalCardProps) {
  const getStatusConfig = (status: Proposal['status']) => {
    switch (status) {
      case 'submitted':
        return {
          icon: CheckCircle2,
          label: 'Submitted',
          className:
            'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
        };
      case 'review':
        return {
          icon: Clock,
          label: 'In Review',
          className:
            'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
        };
      case 'won':
        return {
          icon: Trophy,
          label: 'Won',
          className:
            'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
        };
      case 'lost':
        return {
          icon: XCircle,
          label: 'Lost',
          className:
            'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
        };
      default:
        return {
          icon: FileText,
          label: 'Draft',
          className:
            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
    }
  };

  const statusConfig = getStatusConfig(proposal.status);
  const StatusIcon = statusConfig.icon;

  const formatDate = (date: Date | string) => {
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  };

  return (
    <Card className="hover:border-blue-300 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              <h3 className="font-semibold text-lg truncate">
                Proposal v{proposal.version || '1.0'}
              </h3>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-medium">Created:</span>
                <span>{formatDate(proposal.createdAt)}</span>
              </div>
              {proposal.updatedAt && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Updated:</span>
                  <span>{formatDate(proposal.updatedAt)}</span>
                </div>
              )}
              {proposal.qualityScore !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Quality Score:</span>
                  <span className="font-mono">
                    {(proposal.qualityScore * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Status & Actions */}
          <div className="flex flex-col items-end gap-3 shrink-0">
            <Badge className={statusConfig.className}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(proposal)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                View
              </Button>

              {onRegenerate && proposal.status === 'draft' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRegenerate(proposal.id)}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(proposal.id)}
                disabled={isDeleting}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
