import {
  Paperclip,
  FileText,
  CheckSquare,
  FileQuestion,
  Loader2,
  FileDown,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingCards } from '@/components/shared';
import type { RFPDocumentsProps } from './types';

export function RFPDocuments({
  rfp,
  documents,
  isLoading = false,
  onDownloadDocs,
  isDownloading = false,
}: RFPDocumentsProps) {
  if (isLoading) {
    return <LoadingCards count={1} variant="list" />;
  }

  const fillableDocuments = documents.filter(
    doc => (doc.parsedData as any)?.needsFillOut
  );
  const referenceDocuments = documents.filter(
    doc => !(doc.parsedData as any)?.needsFillOut
  );

  const extractedDocNames = (() => {
    if (
      typeof rfp.requirements === 'object' &&
      rfp.requirements &&
      'documents' in rfp.requirements
    ) {
      const docs = rfp.requirements.documents;
      if (Array.isArray(docs)) {
        return docs
          .map((doc: any) =>
            typeof doc === 'string' ? doc : doc.name || doc.title || ''
          )
          .filter(Boolean);
      }
    }
    return [];
  })();

  return (
    <Card data-testid="card-documents">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="w-5 h-5" />
          RFP Documents ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length > 0 ? (
          <div className="space-y-4">
            {/* Fillable Documents */}
            {fillableDocuments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-foreground dark:text-foreground">
                  <CheckSquare className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                  Forms to Complete
                </h4>
                <div className="space-y-2">
                  {fillableDocuments.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800/50 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors"
                      data-testid={`fillable-doc-${doc.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                            {doc.filename}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            {doc.fileType.toUpperCase()} •{' '}
                            {(doc.parsedData as any)?.category || 'e-bid form attachment'}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-orange-700 dark:text-orange-200 border-orange-400 dark:border-orange-600 bg-orange-100/50 dark:bg-orange-900/50 font-medium whitespace-nowrap flex-shrink-0"
                      >
                        Needs Completion
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reference Documents */}
            {referenceDocuments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-foreground dark:text-foreground">
                  <FileQuestion className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  Reference Documents
                </h4>
                <div className="space-y-2">
                  {referenceDocuments.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors"
                      data-testid={`reference-doc-${doc.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="w-5 h-5 text-slate-600 dark:text-slate-300 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                            {doc.filename}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            {doc.fileType.toUpperCase()} •{' '}
                            {(doc.parsedData as any)?.category || 'solicitation'}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 font-medium whitespace-nowrap flex-shrink-0"
                      >
                        Reference
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                No documents have been downloaded for this RFP yet.
                {rfp.sourceUrl &&
                (rfp.sourceUrl.includes('phlcontracts.phila.gov') ||
                  rfp.sourceUrl.includes('financeonline.austintexas.gov') ||
                  rfp.sourceUrl.includes('austintexas.gov') ||
                  rfp.sourceUrl.includes('beaconbid.com'))
                  ? ' Click below to download documents from the portal.'
                  : ' Documents will be automatically captured during the next portal scan.'}
              </AlertDescription>
            </Alert>

            {/* Document Download for Supported Portals */}
            {rfp.sourceUrl && (
              <>
                {/* Philadelphia Portal */}
                {rfp.sourceUrl.includes('phlcontracts.phila.gov') &&
                  Boolean(rfp.requirements) && (
                    <div className="space-y-2">
                      {extractedDocNames.length > 0 ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {extractedDocNames.length} documents identified from
                            the Philadelphia portal:
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                            {extractedDocNames
                              .slice(0, 5)
                              .map((name: string, idx: number) => (
                                <li key={idx}>• {name}</li>
                              ))}
                            {extractedDocNames.length > 5 && (
                              <li>
                                • ...and {extractedDocNames.length - 5} more
                              </li>
                            )}
                          </ul>
                          <Button
                            onClick={onDownloadDocs}
                            disabled={isDownloading}
                            className="w-full"
                            data-testid="button-download-documents"
                          >
                            {isDownloading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Downloading Documents...
                              </>
                            ) : (
                              <>
                                <FileDown className="w-4 h-4 mr-2" />
                                Download All Documents
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            No document information found in the RFP data.
                            Please re-scrape the RFP to identify documents.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                {/* Austin Finance Portal */}
                {(rfp.sourceUrl.includes('financeonline.austintexas.gov') ||
                  rfp.sourceUrl.includes('austintexas.gov')) && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Documents will be automatically discovered from the Austin
                      Finance portal page.
                    </p>
                    <Button
                      onClick={onDownloadDocs}
                      disabled={isDownloading}
                      className="w-full"
                      data-testid="button-download-documents"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Downloading Documents...
                        </>
                      ) : (
                        <>
                          <FileDown className="w-4 h-4 mr-2" />
                          Download RFP Documents
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* BeaconBid Portal */}
                {rfp.sourceUrl.includes('beaconbid.com') && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Documents will be automatically discovered from the
                      BeaconBid solicitation page.
                    </p>
                    <Button
                      onClick={onDownloadDocs}
                      disabled={isDownloading}
                      className="w-full"
                      data-testid="button-download-documents"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Downloading Documents...
                        </>
                      ) : (
                        <>
                          <FileDown className="w-4 h-4 mr-2" />
                          Download RFP Documents
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
