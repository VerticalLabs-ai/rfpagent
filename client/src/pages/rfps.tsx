import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { Calendar, DollarSign, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

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

export default function RFPsPage() {
  const {
    data: rfps = [],
    isLoading,
    error,
  } = useQuery<RFPWithDetails[]>({
    queryKey: ['/api/rfps/detailed'],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6" data-testid="rfps-loading">
        <h1 className="text-3xl font-bold mb-6">RFPs</h1>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-300 rounded w-full"></div>
                <div className="h-3 bg-gray-300 rounded w-2/3 mt-2"></div>
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
    <div className="flex flex-col h-full overflow-hidden" data-testid="rfps-page">
      <div className="p-6 pb-0 shrink-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">RFPs</h1>
          <Badge variant="secondary" data-testid="rfp-count">
            {rfps.length} Total RFPs
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 pt-0">
          {rfps.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  No RFPs found. Check your portal configurations and try scanning
                  again.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {rfps.map(({ rfp }) => (
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
                          {rfp.status.charAt(0).toUpperCase() + rfp.status.slice(1)}
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
    </div>
  );
}
