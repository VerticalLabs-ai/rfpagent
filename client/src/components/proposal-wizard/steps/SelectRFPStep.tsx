import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FileText, Calendar, Building } from 'lucide-react';
import { useWizard } from '../context';
import { cn } from '@/lib/utils';
import type { RFP } from '@shared/schema';

interface RFPWithDocuments extends RFP {
  documents?: Array<{
    id: string;
    filename: string;
    fileType: string;
    extractedText?: string;
  }>;
}

export function SelectRFPStep() {
  const { state, dispatch } = useWizard();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rfps, isLoading } = useQuery<RFPWithDocuments[]>({
    queryKey: ['/api/rfps', { status: 'discovered,parsing,drafting,review' }],
  });

  const filteredRfps =
    rfps?.filter(
      rfp =>
        rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rfp.agency?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const handleSelectRfp = (rfp: RFPWithDocuments) => {
    dispatch({ type: 'SET_RFP', payload: { rfpId: rfp.id, rfpTitle: rfp.title } });

    // Set attachments from documents
    const attachments = (rfp.documents || []).map(doc => ({
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      selected: true, // Select all by default
      extractedText: doc.extractedText,
    }));
    dispatch({ type: 'SET_ATTACHMENTS', payload: attachments });
  };

  const handleToggleAttachment = (attachmentId: string) => {
    dispatch({ type: 'TOGGLE_ATTACHMENT', payload: attachmentId });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search RFPs by title or agency..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RFP List */}
        <div>
          <h3 className="text-sm font-medium mb-3">Available RFPs</h3>
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-3 space-y-2">
              {filteredRfps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No RFPs found</p>
                </div>
              ) : (
                filteredRfps.map(rfp => (
                  <Card
                    key={rfp.id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      state.rfpId === rfp.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    )}
                    onClick={() => handleSelectRfp(rfp)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-sm line-clamp-2">{rfp.title}</h4>
                        <Badge variant="secondary" className="shrink-0">
                          {rfp.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {rfp.agency || 'Unknown Agency'}
                        </span>
                        {rfp.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(rfp.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Attachments Selection */}
        <div>
          <h3 className="text-sm font-medium mb-3">
            Attachments to Analyze
            {state.attachments.length > 0 && (
              <span className="text-muted-foreground font-normal ml-2">
                ({state.attachments.filter(a => a.selected).length} of {state.attachments.length}{' '}
                selected)
              </span>
            )}
          </h3>
          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-3 space-y-2">
              {!state.rfpId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select an RFP to see attachments</p>
                </div>
              ) : state.attachments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No attachments available</p>
                  <p className="text-xs mt-1">The RFP description will be analyzed instead</p>
                </div>
              ) : (
                state.attachments.map(attachment => (
                  <div
                    key={attachment.id}
                    className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg transition-colors',
                      attachment.selected ? 'bg-primary/5 border-primary/30' : 'hover:bg-accent'
                    )}
                  >
                    <Checkbox
                      checked={attachment.selected}
                      onCheckedChange={() => handleToggleAttachment(attachment.id)}
                    />
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.filename}</p>
                      <p className="text-xs text-muted-foreground uppercase">{attachment.fileType}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
