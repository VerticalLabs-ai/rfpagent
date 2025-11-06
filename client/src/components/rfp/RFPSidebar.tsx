import {
  Download,
  RefreshCw,
  ExternalLink,
  Trash2,
  Loader2,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { RFPSidebarProps } from './types';

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

export function RFPSidebar({
  rfp,
  onDeleteRFP,
  onGenerateMaterials,
  onGenerateProposal,
  onRescrape,
  isDeletePending = false,
  isGeneratingProposal = false,
  isRescrapePending = false,
}: RFPSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Actions */}
      <Card data-testid="card-actions">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Button
              onClick={onGenerateProposal}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isGeneratingProposal}
              data-testid="button-generate-proposal"
            >
              {isGeneratingProposal ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Generate Proposal
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              AI agents will process this RFP and create a complete proposal
              with real-time progress tracking
            </p>
          </div>

          <Button
            onClick={onGenerateMaterials}
            className="w-full bg-green-600 hover:bg-green-700"
            data-testid="button-generate-materials"
          >
            <Download className="w-4 h-4 mr-2" />
            Generate Submission Materials
          </Button>

          <Button
            onClick={onRescrape}
            variant="secondary"
            className="w-full"
            disabled={isRescrapePending}
            data-testid="button-rescrape"
          >
            {isRescrapePending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Re-scrape RFP
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              window.open(rfp.sourceUrl, '_blank', 'noopener,noreferrer')
            }
            className="w-full"
            data-testid="button-open-portal"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Portal
          </Button>

          <Button
            variant="destructive"
            onClick={onDeleteRFP}
            disabled={isDeletePending}
            className="w-full"
            data-testid="button-delete-rfp"
          >
            {isDeletePending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Delete RFP
          </Button>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card data-testid="card-metadata">
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium">Discovered</p>
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-discovered-at"
            >
              {formatDate(rfp.discoveredAt)}
            </p>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium">Last Updated</p>
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-updated-at"
            >
              {formatDate(rfp.updatedAt)}
            </p>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium">Source URL</p>
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => window.open(rfp.sourceUrl, '_blank')}
              data-testid="link-source-url"
            >
              View Original Document
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
