import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  DollarSign,
  ExternalLink,
  X,
  Filter,
  MapPin,
  Building2,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Link } from 'wouter';
import { NaturalLanguageSearchBar } from '@/components/search/NaturalLanguageSearchBar';
import { ProposalWizard } from '@/components/proposal-wizard/ProposalWizard';

interface RFP {
  id: string;
  title: string;
  agency: string;
  sourceUrl: string;
  deadline?: string;
  estimatedValue?: number;
  portalId: string;
  description?: string;
  progress?: number;
  status: string;
}

interface RFPWithDetails {
  rfp: RFP;
}

interface SearchFilters {
  keywords?: string[];
  naicsCodes?: string[];
  setAsideTypes?: string[];
  states?: string[];
  agencies?: string[];
  deadlineAfter?: string;
  deadlineBefore?: string;
  minValue?: number;
  maxValue?: number;
}

interface SearchResult {
  rfps: RFP[];
  totalCount: number;
  appliedFilters: SearchFilters;
  explanation: string;
  suggestions?: string[];
}

export default function RFPsPage() {
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedRfpId, setSelectedRfpId] = useState<string | undefined>();

  const handleOpenWizard = (rfpId?: string) => {
    setSelectedRfpId(rfpId);
    setWizardOpen(true);
  };

  const {
    data: rfps = [],
    isLoading,
    error,
  } = useQuery<RFPWithDetails[]>({
    queryKey: ['/api/rfps/detailed'],
  });

  const handleSearchResults = useCallback((results: SearchResult | null) => {
    if (results) {
      setSearchResults(results);
      setIsSearchMode(true);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchResults(null);
    setIsSearchMode(false);
  }, []);

  // Display RFPs - either from search results or from the standard query
  const displayRfps: RFP[] =
    isSearchMode && searchResults
      ? searchResults.rfps
      : rfps.map(item => item.rfp);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6" data-testid="rfps-loading">
        <h1 className="text-3xl font-bold mb-6">RFPs</h1>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-2/3 mt-2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6" data-testid="rfps-error">
        <h1 className="text-3xl font-bold mb-6">RFPs</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">
              Error loading RFPs:{' '}
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value?: number) => {
    if (!value) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No deadline';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      data-testid="rfps-page"
    >
      <div className="p-6 pb-0 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">RFPs</h1>
          <Badge variant="secondary" data-testid="rfp-count">
            {isSearchMode
              ? `${searchResults?.totalCount ?? 0} Results`
              : `${rfps.length} Total RFPs`}
          </Badge>
        </div>

        {/* Natural Language Search Bar */}
        <NaturalLanguageSearchBar
          onSearchResults={handleSearchResults}
          onClear={handleClearSearch}
          className="mb-4"
        />

        {/* Search Mode - Show Applied Filters & Explanation */}
        {isSearchMode && searchResults && (
          <Card className="mb-4 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
            <CardContent className="py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">
                      AI Search Results
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {searchResults.explanation}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {searchResults.appliedFilters.keywords?.map(kw => (
                      <Badge key={kw} variant="secondary" className="text-xs">
                        {kw}
                      </Badge>
                    ))}
                    {searchResults.appliedFilters.states?.map(state => (
                      <Badge
                        key={state}
                        variant="outline"
                        className="text-xs bg-blue-50 dark:bg-blue-950"
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        {state}
                      </Badge>
                    ))}
                    {searchResults.appliedFilters.setAsideTypes?.map(type => (
                      <Badge
                        key={type}
                        variant="outline"
                        className="text-xs bg-green-50 dark:bg-green-950"
                      >
                        <Building2 className="h-3 w-3 mr-1" />
                        {type}
                      </Badge>
                    ))}
                    {searchResults.appliedFilters.naicsCodes?.map(code => (
                      <Badge
                        key={code}
                        variant="outline"
                        className="text-xs bg-purple-50 dark:bg-purple-950"
                      >
                        <Filter className="h-3 w-3 mr-1" />
                        NAICS {code}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearSearch}
                  className="shrink-0 ml-4"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 pt-0">
          {displayRfps.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  {isSearchMode
                    ? 'No RFPs match your search criteria. Try adjusting your search terms.'
                    : 'No RFPs found. Check your portal configurations and try scanning again.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayRfps.map(rfp => (
                <Card
                  key={rfp.id}
                  className="hover:shadow-md transition-shadow"
                  data-testid={`rfp-card-${rfp.id}`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle
                          className="text-xl mb-2"
                          data-testid={`rfp-title-${rfp.id}`}
                        >
                          {rfp.title}
                        </CardTitle>
                        <p
                          className="text-sm text-muted-foreground mb-2"
                          data-testid={`rfp-agency-${rfp.id}`}
                        >
                          {rfp.agency}
                        </p>
                        {rfp.description && (
                          <p
                            className="text-sm text-foreground line-clamp-2"
                            data-testid={`rfp-description-${rfp.id}`}
                          >
                            {rfp.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleOpenWizard(rfp.id)}
                          data-testid={`rfp-generate-button-${rfp.id}`}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Generate Proposal
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid={`rfp-details-button-${rfp.id}`}
                        >
                          <Link href={`/rfps/${rfp.id}`}>View Details</Link>
                        </Button>
                        {rfp.sourceUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            data-testid={`rfp-source-button-${rfp.id}`}
                          >
                            <a
                              href={rfp.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          STATUS
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-xs font-medium px-3 py-1 min-w-[80px] justify-center"
                          data-testid={`rfp-status-${rfp.id}`}
                        >
                          {rfp.status.charAt(0).toUpperCase() +
                            rfp.status.slice(1)}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          DEADLINE
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span
                            className="text-sm"
                            data-testid={`rfp-deadline-${rfp.id}`}
                          >
                            {formatDate(rfp.deadline)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          VALUE
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span
                            className="text-sm"
                            data-testid={`rfp-value-${rfp.id}`}
                          >
                            {formatCurrency(rfp.estimatedValue)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          PROGRESS
                        </div>
                        <div className="space-y-2">
                          <span
                            className="text-sm"
                            data-testid={`rfp-progress-${rfp.id}`}
                          >
                            {rfp.progress || 0}% complete
                          </span>
                          <Progress
                            value={rfp.progress || 0}
                            className="w-full h-2"
                            data-testid={`rfp-progress-bar-${rfp.id}`}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Proposal Wizard Dialog */}
      <ProposalWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialRfpId={selectedRfpId}
      />
    </div>
  );
}
