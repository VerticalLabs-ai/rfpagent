# PDF Processing Documentation

## Overview

The RFP Agent now includes comprehensive PDF processing capabilities for parsing RFP documents and generating polished proposal PDFs.

## Features

### 1. PDF Text Extraction

Extract text content from PDF documents using `pdf-parse`:

```typescript
import { parsePDFFile } from '@/mastra';

// Parse PDF from file
const result = await parsePDFFile('/path/to/document.pdf');
console.log(result.text); // Extracted text
console.log(result.pages); // Number of pages
console.log(result.metadata); // PDF metadata
```

### 2. PDF Form Detection and Filling

Detect and fill form fields in PDF documents:

```typescript
import { getPDFFormFields, fillPDFForm } from '@/mastra';

// Get all form fields
const fields = await getPDFFormFields('/path/to/form.pdf');
console.log(fields); // Array of field information

// Fill form fields
const filled = await fillPDFForm(
  '/path/to/input.pdf',
  '/path/to/output.pdf',
  [
    { name: 'company_name', value: 'iByte Enterprises', type: 'text' },
    { name: 'agree_terms', value: true, type: 'checkbox' },
  ]
);
```

### 3. Proposal PDF Assembly

Generate polished proposal PDFs from AI-generated content:

```typescript
import { assembleProposalPDF } from '@/mastra';

const result = await assembleProposalPDF('/path/to/output.pdf', {
  title: 'Proposal for City Infrastructure Project',
  author: 'iByte Enterprises LLC',
  subject: 'RFP Response',
  keywords: ['proposal', 'rfp', 'construction'],
  sections: [
    {
      heading: 'Executive Summary',
      content: 'Our company is pleased to submit...',
      fontSize: 14,
      includePageBreak: false,
    },
    {
      heading: 'Technical Approach',
      content: 'We propose a comprehensive approach...',
      fontSize: 12,
      includePageBreak: true,
    },
  ],
});

console.log(`Generated ${result.pages} pages`);
```

### 4. PDF Merging

Combine multiple PDFs into a single document:

```typescript
import { mergePDFs } from '@/mastra';

const result = await mergePDFs(
  [
    '/path/to/cover-letter.pdf',
    '/path/to/proposal.pdf',
    '/path/to/certifications.pdf',
  ],
  '/path/to/merged-proposal.pdf'
);

console.log(`Merged ${result.totalPages} pages`);
```

## Workflow Integration

### Document Processing Workflow

The document processing workflow now includes actual PDF parsing:

```typescript
import { mastra } from '@/mastra';

const result = await mastra.workflows.documentProcessing.execute({
  rfpId: 'rfp-123',
  rfpUrl: 'https://example.gov/rfp/123',
});

// PDFs are automatically:
// 1. Downloaded from RFP page
// 2. Parsed for text content
// 3. Analyzed with AI
// 4. Checked for form fields
// 5. Stored in database
```

### Proposal PDF Assembly Workflow

Generate complete proposal PDFs from AI content:

```typescript
import { mastra } from '@/mastra';

const result = await mastra.workflows.proposalPDFAssembly.execute({
  rfpId: 'rfp-123',
  proposalId: 'prop-456',
});

console.log(result.pdfUrl); // Storage URL
console.log(result.pageCount); // Number of pages
```

## Implementation Details

### Document Processing Flow

1. **Extract Document Links**: Scrapes RFP page for downloadable PDFs
2. **Download Documents**: Downloads all PDFs to temporary storage
3. **Upload to Storage**: Moves PDFs to object storage
4. **Parse PDFs**: Extracts text using pdf-parse library
5. **AI Analysis**: Analyzes content with GPT-5
6. **Form Detection**: Checks for fillable form fields
7. **Database Storage**: Saves all metadata and extracted text

### Proposal Assembly Flow

1. **Gather Content**: Retrieves proposal sections from database
2. **Assemble PDF**: Creates PDF with formatted sections
3. **Upload to Storage**: Stores PDF in object storage
4. **Update Proposal**: Links PDF to proposal record

## Error Handling

All PDF operations include comprehensive error handling:

```typescript
try {
  const result = await parsePDFFile('/path/to/file.pdf');
  // Success
} catch (error) {
  // Logs error details
  console.error('PDF parsing failed:', error);
  // Workflow continues with fallback behavior
}
```

## Logging

All PDF operations are logged with structured data:

```typescript
logger.info('Parsing PDF', { fileName, pages, textLength });
logger.error('PDF parsing failed', { fileName, error });
```

## Performance Considerations

- **Parallel Processing**: Multiple PDFs processed concurrently
- **Memory Management**: Streams large PDFs to avoid memory issues
- **File Cleanup**: Temporary files automatically deleted after processing
- **Caching**: Parsed content stored in database for reuse

## File Organization

### Source Files

- `/src/mastra/utils/pdf-processor.ts` - Core PDF processing utilities
- `/src/mastra/workflows/document-processing-workflow.ts` - Document processing workflow
- `/src/mastra/workflows/proposal-pdf-assembly-workflow.ts` - Proposal PDF generation workflow
- `/types/pdf-parse.d.ts` - Type definitions for pdf-parse
- `/types/pdf-lib.d.ts` - Type definitions for pdf-lib

### Storage Structure

```
private/
  rfps/
    {rfpId}/
      document1.pdf
      document2.pdf
  proposals/
    {rfpId}/
      proposal_{proposalId}_{timestamp}.pdf
```

## Dependencies

- **pdf-parse** (^2.2.16) - Text extraction from PDFs
- **pdf-lib** (^1.17.1) - PDF creation and form filling

## API Reference

### parsePDFFile

```typescript
function parsePDFFile(filePath: string): Promise<PDFParseResult>
```

Parse PDF file and extract text content.

### parsePDFBuffer

```typescript
function parsePDFBuffer(buffer: Buffer): Promise<PDFParseResult>
```

Parse PDF from buffer.

### fillPDFForm

```typescript
function fillPDFForm(
  inputPath: string,
  outputPath: string,
  fields: PDFFormField[]
): Promise<{ success: boolean; outputPath: string; filledFields: number }>
```

Fill PDF form fields.

### getPDFFormFields

```typescript
function getPDFFormFields(
  filePath: string
): Promise<Array<{ name: string; type: string; value?: string }>>
```

Get all form fields from a PDF.

### assembleProposalPDF

```typescript
function assembleProposalPDF(
  outputPath: string,
  options: PDFAssemblyOptions
): Promise<{ success: boolean; outputPath: string; pages: number }>
```

Assemble a proposal PDF from content sections.

### mergePDFs

```typescript
function mergePDFs(
  inputPaths: string[],
  outputPath: string
): Promise<{ success: boolean; outputPath: string; totalPages: number }>
```

Merge multiple PDFs into one document.

## Future Enhancements

- [ ] OCR support for scanned PDFs
- [ ] Advanced form field mapping and auto-fill
- [ ] PDF template system with placeholders
- [ ] Digital signature support
- [ ] PDF compression and optimization
- [ ] Batch processing API
- [ ] Custom watermarking
- [ ] Section reordering UI
