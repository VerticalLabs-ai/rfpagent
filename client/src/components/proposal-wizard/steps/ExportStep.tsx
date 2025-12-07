import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, FileDown, Check, Copy } from 'lucide-react';
import { useWizard } from '../context';
import type { ProposalRow, RfpRow } from '@shared/schema';

type ExportFormat = 'pdf' | 'markdown' | 'text';

export function ExportStep() {
  const { state } = useWizard();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch the generated proposal
  const { data: proposal, isLoading: loadingProposal } = useQuery<ProposalRow>({
    queryKey: ['/api/proposals/rfp', state.rfpId],
    enabled: !!state.rfpId,
  });

  // Fetch RFP details
  const { data: rfp, isLoading: loadingRfp } = useQuery<RfpRow>({
    queryKey: ['/api/rfps', state.rfpId],
    enabled: !!state.rfpId,
  });

  const proposalContent = proposal?.content
    ? typeof proposal.content === 'string'
      ? JSON.parse(proposal.content)
      : proposal.content
    : {};

  const isLoading = loadingProposal || loadingRfp;

  const generateMarkdown = (): string => {
    const lines: string[] = [];
    lines.push(`# Proposal: ${rfp?.title || 'Untitled'}`);
    lines.push('');
    lines.push(`**Prepared for:** ${rfp?.agency || 'N/A'}`);
    lines.push(`**RFP Number:** ${rfp?.solicitationNumber || 'N/A'}`);
    lines.push(`**Date:** ${new Date().toLocaleDateString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    state.sections.forEach(section => {
      lines.push(`## ${section.displayName}`);
      lines.push('');
      lines.push(
        proposalContent[section.id] ||
          '*No content generated for this section.*'
      );
      lines.push('');
    });

    return lines.join('\n');
  };

  const generatePlainText = (): string => {
    const lines: string[] = [];
    lines.push(`PROPOSAL: ${rfp?.title || 'Untitled'}`);
    lines.push('='.repeat(50));
    lines.push('');
    lines.push(`Prepared for: ${rfp?.agency || 'N/A'}`);
    lines.push(`RFP Number: ${rfp?.solicitationNumber || 'N/A'}`);
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    lines.push('');
    lines.push('-'.repeat(50));
    lines.push('');

    state.sections.forEach(section => {
      lines.push(section.displayName.toUpperCase());
      lines.push('-'.repeat(section.displayName.length));
      lines.push('');
      lines.push(
        proposalContent[section.id] || 'No content generated for this section.'
      );
      lines.push('');
      lines.push('');
    });

    return lines.join('\n');
  };

  const generatePdf = async (): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612; // Letter size
    const pageHeight = 792;
    const margin = 72; // 1 inch
    const lineHeight = 14;
    const maxWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const addText = (text: string, fontSize: number, isBold = false): void => {
      const currentFont = isBold ? boldFont : font;
      const words = text.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = currentFont.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && currentLine) {
          if (y < margin + lineHeight) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
          page.drawText(currentLine, {
            x: margin,
            y,
            size: fontSize,
            font: currentFont,
            color: rgb(0, 0, 0),
          });
          y -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        if (y < margin + lineHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(currentLine, {
          x: margin,
          y,
          size: fontSize,
          font: currentFont,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
      }
    };

    // Title
    addText(`Proposal: ${rfp?.title || 'Untitled'}`, 18, true);
    y -= 10;
    addText(`Prepared for: ${rfp?.agency || 'N/A'}`, 12);
    addText(`RFP Number: ${rfp?.solicitationNumber || 'N/A'}`, 12);
    addText(`Date: ${new Date().toLocaleDateString()}`, 12);
    y -= 20;

    // Sections
    for (const section of state.sections) {
      // Section header
      y -= 10;
      addText(section.displayName, 14, true);
      y -= 5;

      // Section content
      const content =
        proposalContent[section.id] || 'No content generated for this section.';
      const paragraphs = content.split('\n');

      for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
          addText(paragraph.trim(), 11);
        } else {
          y -= lineHeight / 2;
        }
      }
      y -= 10;
    }

    return pdfDoc.save();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let content: string | Uint8Array;
      let filename: string;
      let mimeType: string;

      switch (exportFormat) {
        case 'pdf':
          content = await generatePdf();
          filename = `proposal-${state.rfpId}.pdf`;
          mimeType = 'application/pdf';
          break;
        case 'markdown':
          content = generateMarkdown();
          filename = `proposal-${state.rfpId}.md`;
          mimeType = 'text/markdown';
          break;
        case 'text':
          content = generatePlainText();
          filename = `proposal-${state.rfpId}.txt`;
          mimeType = 'text/plain';
          break;
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const content =
      exportFormat === 'markdown' ? generateMarkdown() : generatePlainText();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-semibold">Export Your Proposal</h2>
        <p className="text-muted-foreground">
          Your proposal is ready. Choose a format to export.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={exportFormat}
              onValueChange={v => setExportFormat(v as ExportFormat)}
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-red-500" />
                    <span className="font-medium">PDF Document</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Formatted document ready for submission
                  </p>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="markdown" id="markdown" />
                <Label htmlFor="markdown" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Markdown</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    For editing in Word, Google Docs, or Notion
                  </p>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="text" id="text" />
                <Label htmlFor="text" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">Plain Text</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Simple text format for any application
                  </p>
                </Label>
              </div>
            </RadioGroup>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="flex-1"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                Download
              </Button>
              {exportFormat !== 'pdf' && (
                <Button variant="outline" onClick={handleCopyToClipboard}>
                  {copied ? (
                    <Check className="w-4 h-4 mr-2 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Preview</CardTitle>
              <Badge variant="outline">{state.sections.length} sections</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] border rounded-lg p-4 bg-muted/30">
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-bold text-lg">
                    {rfp?.title || 'Proposal'}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {rfp?.agency} | {rfp?.solicitationNumber}
                  </p>
                </div>
                {state.sections.map(section => (
                  <div key={section.id}>
                    <h4 className="font-semibold text-sm">
                      {section.displayName}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {proposalContent[section.id]?.substring(0, 200) ||
                        'No content'}
                      ...
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{state.sections.length}</p>
              <p className="text-xs text-muted-foreground">Sections</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {state.requirements.filter(r => r.selected).length}
              </p>
              <p className="text-xs text-muted-foreground">
                Requirements Addressed
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {Object.values(proposalContent).reduce(
                  (acc, content) =>
                    acc +
                    (typeof content === 'string'
                      ? content.split(' ').length
                      : 0),
                  0
                )}
              </p>
              <p className="text-xs text-muted-foreground">Words</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {Math.round(state.generationProgress)}%
              </p>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
