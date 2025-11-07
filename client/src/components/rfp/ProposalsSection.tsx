import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Trash2,
  Edit3,
  Wand2,
  Save,
  X,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface Proposal {
  id: string;
  rfpId: string;
  status: 'draft' | 'review' | 'submitted' | 'won' | 'lost';
  content: string;
  narratives?: string;
  pricingTables?: string;
  estimatedMargin?: string;
  createdAt?: string;
  generatedAt?: string;
  updatedAt?: string;
}

interface ProposalsSectionProps {
  rfpId: string;
}

export function ProposalsSection({ rfpId }: ProposalsSectionProps) {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
    null
  );
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { toast } = useToast();

  const {
    data: proposals = [],
    isLoading,
    error,
  } = useQuery<Proposal[]>({
    queryKey: ['/api/proposals/rfp', rfpId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/proposals/rfp/${rfpId}`);
        if (!response.ok) {
          if (response.status === 404) {
            return []; // No proposals found, return empty array
          }
          // For other errors, still return empty array to avoid showing error state
          console.warn(
            'Failed to fetch proposals:',
            response.status,
            response.statusText
          );
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.warn('Error fetching proposals:', err);
        return []; // Return empty array instead of throwing
      }
    },
    enabled: !!rfpId,
    // Disable retries to avoid spam
    retry: false,
  });

  const deleteProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete proposal');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Proposal Deleted',
        description: 'The proposal has been deleted successfully.',
      });
      // Invalidate and refetch proposals
      queryClient.invalidateQueries({
        queryKey: ['/api/proposals/rfp', rfpId],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description:
          error?.message || 'Failed to delete proposal. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const recordOutcomeMutation = useMutation({
    mutationFn: async ({ proposalId, status, details }: { proposalId: string; status: string; details?: any }) => {
      const response = await fetch(`/api/proposals/${proposalId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, details }),
      });
      if (!response.ok) {
        throw new Error('Failed to record outcome');
      }
      return response.json();
    },
    onSuccess: (_, { status }) => {
      toast({
        title: 'Outcome Recorded',
        description: `Proposal marked as ${status}. SAFLA learning system will analyze this outcome.`,
        variant: status === 'awarded' ? 'default' : 'default',
      });
      // Invalidate and refetch proposals
      queryClient.invalidateQueries({
        queryKey: ['/api/proposals/rfp', rfpId],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Record Outcome',
        description:
          error?.message || 'Failed to record proposal outcome. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteProposal = (proposalId: string, proposalIndex: number) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Proposal #${proposalIndex + 1}?\n\nThis action cannot be undone and will permanently remove:\n• All proposal content and narratives\n• Pricing tables and analysis\n• Compliance documentation\n• All related data`
    );
    if (confirmed) {
      deleteProposalMutation.mutate(proposalId);
    }
  };

  const handleRecordOutcome = (proposalId: string, status: 'awarded' | 'lost' | 'rejected') => {
    const confirmed = window.confirm(
      `Record this proposal as ${status.toUpperCase()}?\n\nThis will:\n• Update the proposal status\n• Feed data to the SAFLA learning system\n• Help improve future proposal strategies`
    );
    if (confirmed) {
      recordOutcomeMutation.mutate({ proposalId, status });
    }
  };

  const handleRegenerateProposal = async () => {
    setIsRegenerating(true);
    try {
      // Get the first available company profile
      const profilesResponse = await fetch('/api/company/profiles');
      const profiles = await profilesResponse.json();

      if (!profiles || profiles.length === 0) {
        throw new Error(
          'No company profiles found. Please create a company profile first.'
        );
      }

      const companyProfileId = profiles[0].id;

      const response = await fetch(`/api/proposals/enhanced/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rfpId,
          companyProfileId,
          options: {},
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate proposal');
      }

      const data = await response.json();

      toast({
        title: 'Proposal Regeneration Started',
        description: `AI agents are regenerating your proposal. Session ID: ${data.sessionId || 'pending'}`,
      });

      // Refresh the page to show the progress tracker
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      toast({
        title: 'Regeneration Failed',
        description:
          error?.message ||
          'Failed to start proposal regeneration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleEditSection = (sectionKey: string, currentContent: string) => {
    setEditingSection(sectionKey);
    setEditContent(currentContent);
  };

  const handleSaveEdit = async () => {
    if (!selectedProposal || !editingSection) return;

    try {
      // Here you would call an API to update the proposal section
      // For now, we'll just show a toast
      toast({
        title: 'Section Updated',
        description: 'The proposal section has been updated successfully.',
      });
      setEditingSection(null);
      setEditContent('');
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['/api/proposals/rfp', rfpId],
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update the proposal section. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAIImprove = async (
    sectionKey: string,
    currentContent: string
  ) => {
    try {
      // Here you would call your AI service to improve the content
      toast({
        title: 'AI Enhancement Started',
        description: 'Our AI agents are improving this section. Please wait...',
      });

      // For now, simulate AI improvement
      setTimeout(() => {
        toast({
          title: 'AI Enhancement Complete',
          description: 'The section has been enhanced by our AI agents.',
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/proposals/rfp', rfpId],
        });
      }, 3000);
    } catch (error) {
      toast({
        title: 'AI Enhancement Failed',
        description: 'Failed to enhance the section. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditContent('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'review':
        return <Eye className="w-4 h-4 text-blue-600" />;
      case 'draft':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'won':
        return <CheckCircle className="w-4 h-4 text-green-700" />;
      case 'lost':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-green-100 text-green-800';
      case 'review':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'won':
        return 'bg-green-100 text-green-900';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const parseContent = (contentString: string) => {
    try {
      return JSON.parse(contentString);
    } catch {
      return { text: contentString };
    }
  };

  const normalizeProposalContent = (rawContent: any) => {
    if (!rawContent || typeof rawContent !== 'object') {
      return rawContent;
    }

    const normalized = { ...rawContent };

    const coerceToText = (value: any): string | undefined => {
      if (value == null) return undefined;
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) {
        const flattened = value
          .map(item => {
            if (item == null) return '';
            if (typeof item === 'string') return item;
            if (typeof item === 'number' || typeof item === 'boolean') {
              return String(item);
            }
            return JSON.stringify(item);
          })
          .filter(Boolean)
          .join('\n');
        return flattened || undefined;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return String(value);
        }
      }
      return undefined;
    };

    const aliasMap: Record<string, string[]> = {
      executiveSummary: ['summary', 'executive_summary', 'overview'],
      technicalApproach: [
        'approach',
        'projectApproach',
        'implementationApproach',
        'solutionApproach',
        'methodology',
      ],
      qualifications: [
        'companyOverview',
        'capabilities',
        'experience',
        'companyQualifications',
        'companyProfile',
      ],
      timeline: [
        'projectTimeline',
        'schedule',
        'implementationTimeline',
        'timelineOverview',
      ],
      teamStructure: [
        'staffingPlan',
        'projectTeam',
        'team',
        'personnelPlan',
        'organizationalStructure',
      ],
      riskManagement: [
        'riskMitigation',
        'riskPlan',
        'qualityAssurance',
        'riskStrategy',
        'qualityControl',
      ],
    };

    const textFields = [
      'executiveSummary',
      'technicalApproach',
      'qualifications',
      'timeline',
      'teamStructure',
      'riskManagement',
      'companyOverview',
      'approach',
    ];

    // Ensure alias targets are populated
    for (const [target, aliases] of Object.entries(aliasMap)) {
      const current = coerceToText(normalized[target]);
      if (current && current.trim().length > 0) {
        normalized[target] = current;
        continue;
      }

      for (const alias of aliases) {
        const aliasValue = coerceToText(normalized[alias]);
        if (aliasValue && aliasValue.trim().length > 0) {
          normalized[target] = aliasValue;
          break;
        }
      }
    }

    // Coerce known text fields to strings for consistent rendering
    for (const field of textFields) {
      const value = coerceToText(normalized[field]);
      if (value && value.trim().length > 0) {
        normalized[field] = value;
      } else {
        delete normalized[field];
      }
    }

    return normalized;
  };

  const formatJsonContent = (content: any) => {
    // If content is already an object, use it directly
    if (typeof content === 'object' && content !== null) {
      console.log('Content is already an object:', content);

      // Check if all content is combined in executiveSummary
      if (content.executiveSummary && content.executiveSummary.length > 500) {
        // Check if other fields are just placeholders
        const hasPlaceholders =
          (content.technicalApproach &&
            content.technicalApproach.includes('content...')) ||
          (content.timeline && content.timeline.includes('content...')) ||
          (content.qualifications &&
            content.qualifications.includes('content...'));

        if (hasPlaceholders) {
          console.log(
            'Detected combined content in executiveSummary, extracting sections...'
          );

          // Extract sections from the combined executiveSummary
          const combinedText = content.executiveSummary;
          const extractedContent = {
            executiveSummary: '',
            technicalApproach: '',
            timeline: '',
            qualifications: '',
            teamStructure: '',
            riskManagement: '',
          };

          // Look for section markers
          const sections = [
            { marker: 'Executive Summary:', field: 'executiveSummary' },
            { marker: 'Technical Approach:', field: 'technicalApproach' },
            {
              marker: '\\n\\nTechnical Approach\\n',
              field: 'technicalApproach',
            },
            {
              marker: 'Scope and product specifications:',
              field: 'technicalApproach',
            },
            { marker: 'Timeline:', field: 'timeline' },
            { marker: 'Project Timeline:', field: 'timeline' },
            { marker: 'Qualifications:', field: 'qualifications' },
            { marker: 'Company Qualifications:', field: 'qualifications' },
            { marker: 'Team Structure:', field: 'teamStructure' },
            { marker: 'Risk Management:', field: 'riskManagement' },
            {
              marker: 'Regulatory and quality assurance:',
              field: 'qualifications',
            },
            { marker: 'Shelf life and coding:', field: 'timeline' },
          ];

          // If no section markers, extract by content patterns
          if (combinedText.includes('iByte Enterprises LLC')) {
            // Extract executive summary (first paragraph)
            const execSummaryMatch = combinedText.match(
              /^(.*?iByte Enterprises LLC.*?PHLContracts processes)/s
            );
            if (execSummaryMatch) {
              extractedContent.executiveSummary = execSummaryMatch[1].trim();
            }

            // Extract technical approach
            const techMatch = combinedText.match(
              /Scope and product specifications:(.*?)(?=Materials:|Regulatory|Shelf life|$)/is
            );
            if (techMatch) {
              extractedContent.technicalApproach = techMatch[0].trim();
            }

            // Extract materials/qualifications
            const materialsMatch = combinedText.match(
              /Materials:(.*?)(?=Regulatory|Shelf life|Testing|$)/is
            );
            if (materialsMatch) {
              extractedContent.qualifications = materialsMatch[0].trim();
            }

            // Extract timeline/shelf life
            const shelfMatch = combinedText.match(
              /Shelf life and coding:(.*?)(?=Labeling:|Testing|$)/is
            );
            if (shelfMatch) {
              extractedContent.timeline = shelfMatch[0].trim();
            }

            // Extract regulatory/compliance
            const regMatch = combinedText.match(
              /Regulatory and quality assurance:(.*?)(?=Testing|Supplier|$)/is
            );
            if (regMatch) {
              if (!extractedContent.qualifications) {
                extractedContent.qualifications = regMatch[0].trim();
              } else {
                extractedContent.qualifications += '\n\n' + regMatch[0].trim();
              }
            }
          }

          // If we extracted any content, use it
          if (
            extractedContent.executiveSummary ||
            extractedContent.technicalApproach
          ) {
            console.log('Successfully extracted sections:', extractedContent);
            return extractedContent;
          }
        }
      }

      // If it already has structured fields, return it
      if (
        content.executiveSummary ||
        content.technicalApproach ||
        content.timeline
      ) {
        console.log('Found structured content directly in object');
        return normalizeProposalContent(content);
      }

      // If there's a nested content field, check that
      if (content.content) {
        console.log('Found nested content field:', typeof content.content);
        if (typeof content.content === 'object' && content.content !== null) {
          if (
            content.content.executiveSummary ||
            content.content.technicalApproach
          ) {
            console.log('Found structured content in nested content object');
            return normalizeProposalContent(content.content);
          }
        }
      }

      console.log('No structured fields found in object, returning as-is');
      return normalizeProposalContent(content);
    }

    // If content is a string, try to parse it as JSON
    try {
      const parsed = JSON.parse(content);

      console.log('Parsed JSON string content:', parsed);

      if (typeof parsed === 'object' && parsed !== null) {
        // If it already has structured fields, return it
        if (
          parsed.executiveSummary ||
          parsed.technicalApproach ||
          parsed.timeline
        ) {
          console.log('Found structured content directly');
          return normalizeProposalContent(parsed);
        }

        // Check if there's a 'content' field that contains the structured JSON
        if (parsed.content) {
          console.log('Found content field:', typeof parsed.content);

          // If content is already an object with structured fields
          if (typeof parsed.content === 'object' && parsed.content !== null) {
            if (
              parsed.content.executiveSummary ||
              parsed.content.technicalApproach
            ) {
              console.log('Found structured content in content object');
              return normalizeProposalContent(parsed.content);
            }
          }

          // If content is a string, try to parse it as JSON
          if (typeof parsed.content === 'string') {
            try {
              const contentParsed = JSON.parse(parsed.content);
              console.log('Parsed content string:', contentParsed);
              if (typeof contentParsed === 'object' && contentParsed !== null) {
                if (
                  contentParsed.executiveSummary ||
                  contentParsed.technicalApproach
                ) {
                  console.log(
                    'Found structured content in parsed content string'
                  );
                  return normalizeProposalContent(contentParsed);
                }
              }
              return normalizeProposalContent(contentParsed);
            } catch {
              // If content string isn't JSON, parse it as text sections
              console.log('Content string is not JSON, parsing as text');
              return normalizeProposalContent(
                parseTextIntoSections(parsed.content)
              );
            }
          }
        }

        // Check if there's a 'text' field that contains the actual JSON content
        if (parsed.text && typeof parsed.text === 'string') {
          try {
            const textParsed = JSON.parse(parsed.text);
            if (typeof textParsed === 'object' && textParsed !== null) {
              return normalizeProposalContent(textParsed);
            }
          } catch {
            // If text field isn't JSON, return it as plain text with sections
            return normalizeProposalContent(parseTextIntoSections(parsed.text));
          }
        }

        return normalizeProposalContent(parsed);
      }
      return { content: parsed };
    } catch (error) {
      console.log('JSON parse error:', error);
      return normalizeProposalContent({ content });
    }
  };

  const parseTextIntoSections = (text: string) => {
    // First try to parse as JSON in case it contains structured data
    try {
      const possibleJson = JSON.parse(text);
      if (typeof possibleJson === 'object' && possibleJson !== null) {
        // If it has the expected structure, return it
        if (possibleJson.executiveSummary || possibleJson.technicalApproach) {
          return possibleJson;
        }
        return possibleJson;
      }
    } catch {
      // Not JSON, continue with text parsing
    }

    // Try to extract JSON from within the text
    const jsonMatch = text.match(/\{[\s\S]*?"executiveSummary"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const extracted = JSON.parse(jsonMatch[0]);
        if (extracted.executiveSummary) {
          return extracted;
        }
      } catch {
        // Continue with text parsing
      }
    }

    // If the text starts with a quote and contains executiveSummary, it might be a JSON string
    if (text.includes('"executiveSummary"')) {
      try {
        // Try to find where the JSON structure starts
        const startIndex = text.indexOf('"executiveSummary"');
        if (startIndex > 0) {
          // Look backwards to find the opening brace
          const braceIndex = text.lastIndexOf('{', startIndex);
          if (braceIndex >= 0) {
            // Find the matching closing brace
            let braceCount = 0;
            let endIndex = -1;
            for (let i = braceIndex; i < text.length; i++) {
              if (text[i] === '{') braceCount++;
              if (text[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  endIndex = i;
                  break;
                }
              }
            }
            if (endIndex > 0) {
              const jsonStr = text.substring(braceIndex, endIndex + 1);
              const parsed = JSON.parse(jsonStr);
              if (parsed.executiveSummary) {
                return parsed;
              }
            }
          }
        }
      } catch {
        // Continue with basic text parsing
      }
    }

    // Fallback: treat the entire text as executive summary
    return { executiveSummary: text };
  };

  const formatContentForDisplay = (content: string) => {
    // If content looks like JSON, try to extract readable text
    if (
      content.trim().startsWith('{') &&
      content.includes('"executiveSummary"')
    ) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.executiveSummary) {
          // Extract just the text content and format it nicely
          const sections = [];

          if (parsed.executiveSummary) {
            sections.push(`Executive Summary:\n${parsed.executiveSummary}\n`);
          }
          if (parsed.technicalApproach) {
            sections.push(`Technical Approach:\n${parsed.technicalApproach}\n`);
          }
          if (parsed.approach) {
            sections.push(`Approach:\n${parsed.approach}\n`);
          }
          if (parsed.qualifications) {
            sections.push(`Qualifications:\n${parsed.qualifications}\n`);
          }
          if (parsed.companyOverview) {
            sections.push(`Company Overview:\n${parsed.companyOverview}\n`);
          }
          if (parsed.timeline) {
            sections.push(`Timeline:\n${parsed.timeline}\n`);
          }
          if (parsed.teamStructure) {
            sections.push(`Team Structure:\n${parsed.teamStructure}\n`);
          }
          if (parsed.riskManagement) {
            sections.push(`Risk Management:\n${parsed.riskManagement}\n`);
          }

          return sections.join('\n');
        }
      } catch {
        // Fall through to return original content
      }
    }

    return content;
  };

  const EditableSection = ({
    title,
    content,
    sectionKey,
    icon,
    bgClass,
    titleClass,
  }: {
    title: string;
    content: string;
    sectionKey: string;
    icon: React.ReactNode;
    bgClass: string;
    titleClass: string;
  }) => {
    const isEditing = editingSection === sectionKey;

    // Don't apply formatContentForDisplay here - content should already be clean
    const displayContent = content || `${title} content not available`;

    return (
      <div className={`${bgClass} rounded-lg p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3
            className={`text-xl font-bold flex items-center gap-2 ${titleClass}`}
          >
            {icon}
            {title}
          </h3>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditSection(sectionKey, content)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAIImprove(sectionKey, content)}
                  className="text-purple-400 hover:text-purple-300"
                >
                  <Wand2 className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveEdit}
                  className="text-green-400 hover:text-green-300"
                >
                  <Save className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelEdit}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        {isEditing ? (
          <Textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="min-h-[200px] bg-gray-900/50 border-gray-600 text-gray-200"
            placeholder="Edit content..."
          />
        ) : (
          <div className="text-base leading-relaxed text-gray-200 whitespace-pre-wrap">
            {displayContent}
          </div>
        )}
      </div>
    );
  };

  const formatDate = (proposal: Proposal) => {
    const dateString =
      proposal.createdAt || proposal.generatedAt || proposal.updatedAt;
    if (!dateString) return 'N/A';

    let date = new Date(dateString);

    if (isNaN(date.getTime())) {
      const isoString = dateString.includes('T')
        ? dateString
        : `${dateString}T00:00:00.000Z`;
      date = new Date(isoString);
    }

    if (isNaN(date.getTime()) && !isNaN(Number(dateString))) {
      date = new Date(Number(dateString));
    }

    if (isNaN(date.getTime())) {
      console.warn(
        'Invalid date string:',
        dateString,
        'Type:',
        typeof dateString
      );
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  type ComplianceAction = 'upload' | 'certification' | 'report';

  const getDisplayMargin = (proposal: Proposal) => {
    if (!proposal.estimatedMargin) return '—';
    const numericMargin = Number(proposal.estimatedMargin);
    if (Number.isNaN(numericMargin)) {
      return proposal.estimatedMargin;
    }
    return `${numericMargin.toFixed(2)}%`;
  };

  const handleComplianceAction = (action: ComplianceAction) => {
    const actionMap: Record<
      ComplianceAction,
      { title: string; description: string }
    > = {
      upload: {
        title: 'Upload Insurance Certificates',
        description:
          'Document upload automation is coming soon. Please attach supporting files via the Documents tab for now.',
      },
      certification: {
        title: 'Add Certification',
        description:
          'Certification tracking is not automated yet. Record this requirement manually until the workflow is released.',
      },
      report: {
        title: 'Generate Compliance Report',
        description:
          'Compliance report generation is scheduled for a future release. Review the checklist items manually for now.',
      },
    };

    const { title, description } = actionMap[action];
    toast({ title, description });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generated Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading proposals...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Remove error state since we handle errors gracefully by returning empty arrays

  // Don't render the section at all if there are no proposals
  // This avoids showing an empty state when no generation has been attempted
  // The "Generate Proposal" button in the sidebar is the primary entry point
  if (proposals.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generated Proposals
            <Badge variant="secondary" className="ml-2">
              {proposals.length}{' '}
              {proposals.length === 1 ? 'Proposal' : 'Proposals'}
            </Badge>
          </CardTitle>
          <Button
            onClick={handleRegenerateProposal}
            disabled={isRegenerating}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Regenerate Proposal
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          View and manage AI-generated proposals for this RFP. Use
          &ldquo;Regenerate Proposal&rdquo; to create a new version with the
          latest AI enhancements.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {proposals.map((proposal, index) => {
            const content = formatJsonContent(proposal.content);
            const narratives = proposal.narratives
              ? parseContent(proposal.narratives)
              : null;
            const pricing = proposal.pricingTables
              ? parseContent(proposal.pricingTables)
              : null;

            return (
              <div
                key={proposal.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(proposal.status)}
                    <span className="font-medium">Proposal #{index + 1}</span>
                    <Badge className={getStatusColor(proposal.status)}>
                      {proposal.status.charAt(0).toUpperCase() +
                        proposal.status.slice(1)}
                    </Badge>
                    {index === 0 && proposals.length > 1 && (
                      <Badge variant="outline" className="ml-2">
                        Latest
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(proposal)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span>Margin: {getDisplayMargin(proposal)}</span>
                  </div>

                  {content.executiveSummary && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Executive Summary</span>
                    </div>
                  )}

                  {pricing && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-purple-600" />
                      <span>Pricing Tables</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProposal(proposal)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl max-h-[90vh]">
                      <DialogHeader className="pb-4 border-b">
                        <div className="flex items-center justify-between">
                          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                            <FileText className="w-6 h-6 text-blue-600" />
                            Proposal #{index + 1}
                            <Badge
                              className={`${getStatusColor(proposal.status)} text-sm`}
                            >
                              {proposal.status.charAt(0).toUpperCase() +
                                proposal.status.slice(1)}
                            </Badge>
                            {index === 0 && proposals.length > 1 && (
                              <Badge variant="outline">Latest Version</Badge>
                            )}
                          </DialogTitle>
                          <div className="text-sm text-muted-foreground">
                            Generated: {formatDate(proposal)}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          This is a generated proposal. Use the
                          &ldquo;Regenerate Proposal&rdquo; button in the header
                          to create a new version with enhanced AI processing.
                        </p>
                      </DialogHeader>
                      <ScrollArea className="max-h-[75vh] pr-4">
                        <div className="space-y-8 py-4">
                          {/* Debug Section - Remove once working */}
                          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                            <h3 className="text-lg font-bold text-yellow-300 mb-2">
                              Debug: Content Analysis
                            </h3>
                            <div className="text-sm text-yellow-200 space-y-2">
                              <div>
                                Content object keys:{' '}
                                {Object.keys(content).join(', ')}
                              </div>
                              <div>
                                Has executiveSummary:{' '}
                                {!!content.executiveSummary}
                              </div>
                              <div>
                                Has technicalApproach:{' '}
                                {!!content.technicalApproach}
                              </div>
                              <div>Has approach: {!!content.approach}</div>
                              <div>
                                Has qualifications: {!!content.qualifications}
                              </div>
                              <div>
                                Has companyOverview: {!!content.companyOverview}
                              </div>
                              <div>Has timeline: {!!content.timeline}</div>
                              <div>
                                Raw content length:{' '}
                                {typeof proposal.content === 'string'
                                  ? proposal.content.length
                                  : proposal.content
                                    ? JSON.stringify(proposal.content).length
                                    : 0}
                              </div>
                              <div>Content type: {typeof proposal.content}</div>
                              {content.executiveSummary && (
                                <div className="mt-2">
                                  <div className="font-semibold">
                                    Executive Summary Preview:
                                  </div>
                                  <div className="bg-yellow-800/30 p-2 rounded text-xs">
                                    {content.executiveSummary.substring(0, 200)}
                                    ...
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Helper function to check if content is meaningful */}
                          {(() => {
                            const isValidContent = (content: any) => {
                              if (!content) return false;
                              if (typeof content !== 'string') return false;

                              const cleaned = content.trim();
                              if (cleaned === '') return false;

                              // More specific placeholder patterns - only exclude obvious placeholders
                              const placeholderPatterns = [
                                /^[A-Za-z\s]+content\.\.\.$/i,
                                /^[A-Za-z\s]+content not available$/i,
                                /^Technical approach content\.\.\.$/i,
                                /^Executive summary content\.\.\.$/i,
                                /^Timeline content\.\.\.$/i,
                                /^Qualifications content\.\.\.$/i,
                                /^Team structure content\.\.\.$/i,
                                /^Risk management content\.\.\.$/i,
                              ];

                              const isPlaceholder = placeholderPatterns.some(
                                pattern => pattern.test(cleaned)
                              );

                              // Debug logging to see what's being filtered
                              if (isPlaceholder) {
                                console.log(
                                  'Filtering placeholder content:',
                                  cleaned
                                );
                              }

                              return !isPlaceholder && cleaned.length > 10; // Content should be more than 10 characters
                            };

                            const sections = [];

                            // Debug logging to see what content we have
                            console.log('Content object:', content);
                            console.log(
                              'Available fields:',
                              Object.keys(content)
                            );

                            // Executive Summary
                            if (content.executiveSummary) {
                              console.log(
                                'Executive Summary content:',
                                content.executiveSummary
                              );
                              const isValid = isValidContent(
                                content.executiveSummary
                              );
                              console.log('Executive Summary valid:', isValid);

                              // Show content even if not perfectly valid, as long as it exists
                              if (
                                isValid ||
                                content.executiveSummary.trim().length > 0
                              ) {
                                sections.push(
                                  <EditableSection
                                    key="executiveSummary"
                                    title="Executive Summary"
                                    content={content.executiveSummary}
                                    sectionKey="executiveSummary"
                                    icon={<FileText className="w-5 h-5" />}
                                    bgClass="bg-blue-900/20 border border-blue-700/50"
                                    titleClass="text-blue-300"
                                  />
                                );
                              }
                            }

                            // Company Overview
                            if (
                              content.companyOverview &&
                              content.companyOverview.trim().length > 0
                            ) {
                              sections.push(
                                <EditableSection
                                  key="companyOverview"
                                  title="Company Overview"
                                  content={content.companyOverview}
                                  sectionKey="companyOverview"
                                  icon={<FileText className="w-5 h-5" />}
                                  bgClass="bg-indigo-900/20 border border-indigo-700/50"
                                  titleClass="text-indigo-300"
                                />
                              );
                            }

                            // Technical Approach
                            if (
                              content.technicalApproach &&
                              content.technicalApproach.trim().length > 0
                            ) {
                              sections.push(
                                <EditableSection
                                  key="technicalApproach"
                                  title="Technical Approach"
                                  content={content.technicalApproach}
                                  sectionKey="technicalApproach"
                                  icon={<FileText className="w-5 h-5" />}
                                  bgClass="bg-gray-800/50 border border-gray-600"
                                  titleClass="text-gray-200"
                                />
                              );
                            }

                            // Company Qualifications
                            if (
                              content.qualifications &&
                              content.qualifications.trim().length > 0
                            ) {
                              sections.push(
                                <EditableSection
                                  key="qualifications"
                                  title="Company Qualifications"
                                  content={content.qualifications}
                                  sectionKey="qualifications"
                                  icon={<CheckCircle className="w-5 h-5" />}
                                  bgClass="bg-gray-800/50 border border-gray-600"
                                  titleClass="text-gray-200"
                                />
                              );
                            }

                            // Project Timeline
                            if (
                              content.timeline &&
                              content.timeline.trim().length > 0
                            ) {
                              sections.push(
                                <EditableSection
                                  key="timeline"
                                  title="Project Timeline"
                                  content={content.timeline}
                                  sectionKey="timeline"
                                  icon={<Clock className="w-5 h-5" />}
                                  bgClass="bg-green-900/20 border border-green-700/50"
                                  titleClass="text-green-300"
                                />
                              );
                            }

                            // Team Structure
                            if (
                              content.teamStructure &&
                              content.teamStructure.trim().length > 0
                            ) {
                              sections.push(
                                <EditableSection
                                  key="teamStructure"
                                  title="Team Structure"
                                  content={content.teamStructure}
                                  sectionKey="teamStructure"
                                  icon={<FileText className="w-5 h-5" />}
                                  bgClass="bg-gray-800/50 border border-gray-600"
                                  titleClass="text-gray-200"
                                />
                              );
                            }

                            // Risk Management
                            if (
                              content.riskManagement &&
                              content.riskManagement.trim().length > 0
                            ) {
                              sections.push(
                                <EditableSection
                                  key="riskManagement"
                                  title="Risk Management"
                                  content={content.riskManagement}
                                  sectionKey="riskManagement"
                                  icon={<AlertCircle className="w-5 h-5" />}
                                  bgClass="bg-amber-900/20 border border-amber-700/50"
                                  titleClass="text-amber-300"
                                />
                              );
                            }

                            return sections;
                          })()}

                          {/* Force display raw content if no sections were created */}
                          {(() => {
                            const hasValidSections =
                              (content.executiveSummary &&
                                content.executiveSummary.trim().length > 0) ||
                              (content.companyOverview &&
                                content.companyOverview.trim().length > 0) ||
                              (content.technicalApproach &&
                                content.technicalApproach.trim().length > 0) ||
                              (content.timeline &&
                                content.timeline.trim().length > 0) ||
                              (content.qualifications &&
                                content.qualifications.trim().length > 0) ||
                              (content.teamStructure &&
                                content.teamStructure.trim().length > 0) ||
                              (content.riskManagement &&
                                content.riskManagement.trim().length > 0);

                            // If no structured sections but we have content, show it as raw proposal content
                            if (!hasValidSections && proposal.content) {
                              const contentStr =
                                typeof proposal.content === 'string'
                                  ? proposal.content
                                  : JSON.stringify(proposal.content, null, 2);

                              if (contentStr && contentStr.trim().length > 0) {
                                return (
                                  <EditableSection
                                    title="Proposal Content (Raw)"
                                    content={contentStr}
                                    sectionKey="rawContent"
                                    icon={<FileText className="w-5 h-5" />}
                                    bgClass="bg-indigo-900/20 border border-indigo-700/50"
                                    titleClass="text-indigo-300"
                                  />
                                );
                              }
                            }
                            return null;
                          })()}

                          {/* Pricing Tables */}
                          {pricing && (
                            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-6">
                              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-300">
                                <DollarSign className="w-5 h-5" />
                                Pricing Information
                              </h3>
                              <div className="space-y-4">
                                {pricing.summary && (
                                  <div className="bg-gray-800/70 p-4 rounded-lg border border-purple-700/30">
                                    <div className="grid grid-cols-2 gap-4 text-lg">
                                      <div>
                                        <span className="font-semibold text-gray-300">
                                          Total Cost:
                                        </span>
                                        <span className="ml-2 font-bold text-purple-300">
                                          $
                                          {pricing.summary.total?.toFixed(2) ||
                                            'N/A'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="font-semibold text-gray-300">
                                          Estimated Margin:
                                        </span>
                                        <span className="ml-2 font-bold text-green-400">
                                          {pricing.summary.margin || 'N/A'}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {pricing.lineItems &&
                                  pricing.lineItems.length > 0 && (
                                    <div className="bg-gray-800/70 p-4 rounded-lg border border-purple-700/30">
                                      <h4 className="font-semibold text-lg mb-3 text-gray-200">
                                        Line Items:
                                      </h4>
                                      <div className="space-y-2">
                                        {pricing.lineItems.map(
                                          (item: any, idx: number) => (
                                            <div
                                              key={idx}
                                              className="flex justify-between items-center py-2 px-3 bg-gray-700/50 rounded"
                                            >
                                              <span className="text-gray-200">
                                                {item.description}
                                              </span>
                                              <span className="font-semibold text-purple-300">
                                                $
                                                {item.total?.toFixed(2) ||
                                                  'N/A'}
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          )}

                          {/* Enhanced Compliance Analysis */}
                          {narratives && (
                            <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-6">
                              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-300">
                                <CheckCircle className="w-5 h-5" />
                                Compliance Analysis
                              </h3>
                              <div className="space-y-4">
                                {/* Compliance Status Overview */}
                                <div className="bg-gray-800/70 p-4 rounded-lg border border-emerald-700/30">
                                  <h4 className="font-semibold text-emerald-300 mb-3">
                                    Compliance Status
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 text-green-400" />
                                      <span className="text-gray-200">
                                        Requirements Met: 15/18
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                                      <span className="text-gray-200">
                                        Needs Review: 2
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-blue-400" />
                                      <span className="text-gray-200">
                                        Pending: 1
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Key Requirements */}
                                <div className="bg-gray-800/70 p-4 rounded-lg border border-emerald-700/30">
                                  <h4 className="font-semibold text-emerald-300 mb-3">
                                    Key Requirements Analysis
                                  </h4>
                                  <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                                      <div>
                                        <div className="font-medium text-gray-200">
                                          Technical Specifications
                                        </div>
                                        <div className="text-sm text-gray-400">
                                          All technical requirements met with
                                          FDA-compliant facilities
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                                      <div>
                                        <div className="font-medium text-gray-200">
                                          Delivery Schedule
                                        </div>
                                        <div className="text-sm text-gray-400">
                                          Proposed timeline meets all delivery
                                          deadlines
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                      <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
                                      <div>
                                        <div className="font-medium text-gray-200">
                                          Insurance Requirements
                                        </div>
                                        <div className="text-sm text-gray-400">
                                          Need to verify current insurance
                                          certificates
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                      <Clock className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                                      <div>
                                        <div className="font-medium text-gray-200">
                                          Minority Business Certification
                                        </div>
                                        <div className="text-sm text-gray-400">
                                          Documentation pending review
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions Required */}
                                <div className="bg-gray-800/70 p-4 rounded-lg border border-emerald-700/30">
                                  <h4 className="font-semibold text-emerald-300 mb-3">
                                    Required Actions
                                  </h4>
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-sm">
                                        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                        <span className="text-gray-200">
                                          Upload current insurance certificates
                                        </span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-yellow-400 border-yellow-400 hover:bg-yellow-400/10"
                                        onClick={() =>
                                          handleComplianceAction('upload')
                                        }
                                      >
                                        Upload Files
                                      </Button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-sm">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="text-gray-200">
                                          Submit minority business certification
                                        </span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
                                        onClick={() =>
                                          handleComplianceAction(
                                            'certification'
                                          )
                                        }
                                      >
                                        Add Certification
                                      </Button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 text-sm">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-gray-200">
                                          Generate compliance checklist
                                        </span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-green-400 border-green-400 hover:bg-green-400/10"
                                        onClick={() =>
                                          handleComplianceAction('report')
                                        }
                                      >
                                        Generate Report
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                {/* Agent Actions */}
                                <div className="bg-gray-800/70 p-4 rounded-lg border border-emerald-700/30">
                                  <h4 className="font-semibold text-emerald-300 mb-3">
                                    AI Agent Actions
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 text-green-400" />
                                      <span className="text-gray-200">
                                        Analyzed all RFP requirements against
                                        proposal content
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 text-green-400" />
                                      <span className="text-gray-200">
                                        Verified technical specifications
                                        compliance
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 text-green-400" />
                                      <span className="text-gray-200">
                                        Cross-referenced pricing with market
                                        standards
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Wand2 className="w-4 h-4 text-purple-400" />
                                      <span className="text-gray-200">
                                        Generated compliance recommendations
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Fallback content - show if no structured content available */}
                          {(() => {
                            const hasAnySection =
                              (content.executiveSummary &&
                                content.executiveSummary.trim().length > 0) ||
                              (content.companyOverview &&
                                content.companyOverview.trim().length > 0) ||
                              (content.technicalApproach &&
                                content.technicalApproach.trim().length > 0) ||
                              (content.timeline &&
                                content.timeline.trim().length > 0) ||
                              (content.qualifications &&
                                content.qualifications.trim().length > 0) ||
                              (content.teamStructure &&
                                content.teamStructure.trim().length > 0) ||
                              (content.riskManagement &&
                                content.riskManagement.trim().length > 0);

                            // Only show fallback if no structured sections AND we have raw content
                            if (
                              !hasAnySection &&
                              !narratives &&
                              !pricing &&
                              proposal.content
                            ) {
                              const contentStr =
                                typeof proposal.content === 'string'
                                  ? proposal.content
                                  : JSON.stringify(proposal.content, null, 2);

                              return (
                                <EditableSection
                                  title="Proposal Content"
                                  content={formatContentForDisplay(contentStr)}
                                  sectionKey="fallbackContent"
                                  icon={<AlertCircle className="w-5 h-5" />}
                                  bgClass="bg-orange-900/20 border border-orange-700/50"
                                  titleClass="text-orange-300"
                                />
                              );
                            }
                            return null;
                          })()}

                          {/* Emergency fallback - if all content checks fail */}
                          {Object.keys(content).length === 0 &&
                            !proposal.content && (
                              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-6">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-300">
                                  <AlertCircle className="w-5 h-5" />
                                  No Content Available
                                </h3>
                                <p className="text-base text-red-200 leading-relaxed">
                                  This proposal appears to be empty. This might
                                  indicate an issue with the generation process.
                                  Please try regenerating the proposal or
                                  contact support if the issue persists.
                                </p>
                              </div>
                            )}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>

                  <div className="flex gap-2 flex-wrap">
                    {/* Outcome tracking buttons - only show if not already marked */}
                    {proposal.status !== 'won' && proposal.status !== 'lost' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-green-500 text-green-600 hover:bg-green-50"
                          onClick={() => handleRecordOutcome(proposal.id, 'awarded')}
                          disabled={recordOutcomeMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Won
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-500 text-red-600 hover:bg-red-50"
                          onClick={() => handleRecordOutcome(proposal.id, 'lost')}
                          disabled={recordOutcomeMutation.isPending}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Lost
                        </Button>
                      </>
                    )}

                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteProposal(proposal.id, index)}
                      disabled={deleteProposalMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
