import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronLeft,
  Download,
  Send,
  Edit2,
  Save,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  Trophy,
  FileText,
} from 'lucide-react';
import { Proposal, ProposalContent } from '../types';

interface ProposalDetailProps {
  proposal: Proposal;
  onBack: () => void;
  onUpdate: (proposalId: string, section: string, content: string) => void;
  onSubmit?: (proposalId: string) => void;
  isUpdating?: boolean;
}

export function ProposalDetail({
  proposal,
  onBack,
  onUpdate,
  onSubmit,
  isUpdating,
}: ProposalDetailProps) {
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const getStatusConfig = (status: Proposal['status']) => {
    switch (status) {
      case 'submitted':
        return {
          icon: CheckCircle2,
          label: 'Submitted',
          className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
        };
      case 'review':
        return {
          icon: Clock,
          label: 'In Review',
          className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
        };
      case 'won':
        return {
          icon: Trophy,
          label: 'Won',
          className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
        };
      case 'lost':
        return {
          icon: XCircle,
          label: 'Lost',
          className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
        };
      default:
        return {
          icon: FileText,
          label: 'Draft',
          className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        };
    }
  };

  const statusConfig = getStatusConfig(proposal.status);
  const StatusIcon = statusConfig.icon;

  const content =
    typeof proposal.content === 'string'
      ? { text: proposal.content }
      : (proposal.content as ProposalContent);

  const sections = [
    { key: 'executiveSummary', label: 'Executive Summary', content: content.executiveSummary },
    { key: 'technicalApproach', label: 'Technical Approach', content: content.technicalApproach },
    { key: 'pricing', label: 'Pricing', content: content.pricing },
    { key: 'timeline', label: 'Timeline', content: content.timeline },
    { key: 'qualifications', label: 'Qualifications', content: content.qualifications },
  ];

  const handleEdit = (sectionKey: string, currentContent: string) => {
    setEditingSection(sectionKey);
    setEditContent(currentContent || '');
  };

  const handleSave = () => {
    if (editingSection) {
      onUpdate(proposal.id, editingSection, editContent);
      setEditingSection(null);
      setEditContent('');
    }
  };

  const handleCancel = () => {
    setEditingSection(null);
    setEditContent('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          Back to List
        </Button>

        <div className="flex items-center gap-3">
          <Badge className={statusConfig.className}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig.label}
          </Badge>

          {proposal.status === 'draft' && onSubmit && (
            <Button onClick={() => onSubmit(proposal.id)} className="gap-2">
              <Send className="w-4 h-4" />
              Submit Proposal
            </Button>
          )}

          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Proposal v{proposal.version || '1.0'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Created:</span>
              <div>{format(new Date(proposal.createdAt), 'PPpp')}</div>
            </div>
            {proposal.updatedAt && (
              <div>
                <span className="font-medium text-muted-foreground">Updated:</span>
                <div>{format(new Date(proposal.updatedAt), 'PPpp')}</div>
              </div>
            )}
            {proposal.qualityScore !== undefined && (
              <div>
                <span className="font-medium text-muted-foreground">Quality Score:</span>
                <div className="font-mono text-lg">
                  {(proposal.qualityScore * 100).toFixed(1)}%
                </div>
              </div>
            )}
            {proposal.submissionDate && (
              <div>
                <span className="font-medium text-muted-foreground">Submitted:</span>
                <div>{format(new Date(proposal.submissionDate), 'PPpp')}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{section.label}</CardTitle>
                {proposal.status === 'draft' && editingSection !== section.key && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(section.key, section.content || '')}
                    className="gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingSection === section.key ? (
                <div className="space-y-3">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                    disabled={isUpdating}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSave}
                      disabled={isUpdating}
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleCancel}
                      disabled={isUpdating}
                      className="gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap">{section.content || 'No content yet.'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full Content Fallback */}
      {typeof proposal.content === 'string' && (
        <Card>
          <CardHeader>
            <CardTitle>Full Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap">{proposal.content}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
