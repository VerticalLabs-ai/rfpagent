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
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-orange-500" />
                  Forms to Complete
                </h4>
                <div className="space-y-2">
                  {fillableDocuments.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950/20 rounded"
                      data-testid={`fillable-doc-${doc.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-orange-500" />
                        <div>
                          <p className="text-sm font-medium">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileType.toUpperCase()} •{' '}
                            {(doc.parsedData as any)?.category || 'Document'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-orange-600">
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
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FileQuestion className="w-4 h-4 text-blue-500" />
                  Reference Documents
                </h4>
                <div className="space-y-2">
                  {referenceDocuments.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded"
                      data-testid={`reference-doc-${doc.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileType.toUpperCase()} •{' '}
                            {(doc.parsedData as any)?.category || 'Document'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Reference</Badge>
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
                {rfp.sourceUrl && (rfp.sourceUrl.includes('phlcontracts.phila.gov') ||
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
                {rfp.sourceUrl.includes('phlcontracts.phila.gov') && Boolean(rfp.requirements) && (
                  <div className="space-y-2">
                    {extractedDocNames.length > 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {extractedDocNames.length} documents identified from the
                          Philadelphia portal:
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                          {extractedDocNames
                            .slice(0, 5)
                            .map((name: string, idx: number) => (
                              <li key={idx}>• {name}</li>
                            ))}
                          {extractedDocNames.length > 5 && (
                            <li>• ...and {extractedDocNames.length - 5} more</li>
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
                          No document information found in the RFP data. Please
                          re-scrape the RFP to identify documents.
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
                      Documents will be automatically discovered from the Austin Finance portal page.
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
                      Documents will be automatically discovered from the BeaconBid solicitation page.
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
