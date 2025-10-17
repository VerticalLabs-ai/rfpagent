import * as fs from 'fs';
import {
  PDFCheckBox,
  PDFDocument,
  PDFTextField,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { logger } from '../../../server/utils/logger';

export interface PDFParseResult {
  text: string;
  pages: number;
  metadata?: Record<string, unknown>;
  info?: Record<string, unknown>;
}

export interface PDFFormField {
  name: string;
  value: string | boolean;
  type: 'text' | 'checkbox' | 'radio' | 'dropdown';
}

export interface PDFAssemblyOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  sections?: PDFSection[];
}

export interface PDFSection {
  heading: string;
  content: string;
  fontSize?: number;
  includePageBreak?: boolean;
}

/**
 * Parse PDF file and extract text content
 * @param filePath - Path to the PDF file
 * @returns Parsed PDF content with text and metadata
 */
export async function parsePDFFile(filePath: string): Promise<PDFParseResult> {
  try {
    logger.info(`Starting PDF parsing for: ${filePath}`);

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    logger.info(`Successfully parsed PDF: ${filePath}`, {
      pages: data.numpages,
      textLength: data.text.length,
    });

    return {
      text: data.text,
      pages: data.numpages,
      metadata: data.metadata as Record<string, unknown> | undefined,
      info: data.info as Record<string, unknown> | undefined,
    };
  } catch (error) {
    logger.error(`Failed to parse PDF: ${filePath}`, error as Error);
    throw new Error(
      `PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse PDF from buffer
 * @param buffer - PDF file buffer
 * @returns Parsed PDF content
 */
export async function parsePDFBuffer(buffer: Buffer): Promise<PDFParseResult> {
  try {
    logger.info('Starting PDF parsing from buffer');

    const data = await pdfParse(buffer);

    logger.info('Successfully parsed PDF from buffer', {
      pages: data.numpages,
      textLength: data.text.length,
    });

    return {
      text: data.text,
      pages: data.numpages,
      metadata: data.metadata as Record<string, unknown> | undefined,
      info: data.info as Record<string, unknown> | undefined,
    };
  } catch (error) {
    logger.error('Failed to parse PDF buffer', error as Error);
    throw new Error(
      `PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fill PDF form fields
 * @param inputPath - Path to input PDF with form fields
 * @param outputPath - Path where filled PDF will be saved
 * @param fields - Form fields to fill
 * @returns Success status and output path
 */
export async function fillPDFForm(
  inputPath: string,
  outputPath: string,
  fields: PDFFormField[]
): Promise<{ success: boolean; outputPath: string; filledFields: number }> {
  try {
    logger.info(`Filling PDF form: ${inputPath}`, {
      fieldCount: fields.length,
    });

    const existingPdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    let filledCount = 0;

    for (const field of fields) {
      try {
        if (field.type === 'text') {
          const textField = form.getTextField(field.name);
          textField.setText(field.value as string);
          filledCount++;
        } else if (
          field.type === 'checkbox' &&
          typeof field.value === 'boolean'
        ) {
          const checkBox = form.getCheckBox(field.name);
          if (field.value) {
            checkBox.check();
          } else {
            checkBox.uncheck();
          }
          filledCount++;
        }
        logger.debug(`Filled field: ${field.name}`);
      } catch (fieldError) {
        logger.warn(`Failed to fill field: ${field.name}`, fieldError as Error);
      }
    }

    // Flatten the form to make it non-editable
    form.flatten();

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    logger.info(`Successfully filled PDF form`, {
      inputPath,
      outputPath,
      filledFields: filledCount,
      totalFields: fields.length,
    });

    return {
      success: true,
      outputPath,
      filledFields: filledCount,
    };
  } catch (error) {
    logger.error(`Failed to fill PDF form: ${inputPath}`, error as Error);
    throw new Error(
      `PDF form filling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all form fields from a PDF
 * @param filePath - Path to PDF file
 * @returns Array of form field information
 */
export async function getPDFFormFields(
  filePath: string
): Promise<Array<{ name: string; type: string; value?: string }>> {
  try {
    logger.info(`Getting form fields from: ${filePath}`);

    const existingPdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    const fields = form.getFields();
    const fieldInfo = fields.map(field => {
      const name = field.getName();
      let type = 'unknown';
      let value: string | undefined;

      if (field instanceof PDFTextField) {
        type = 'text';
        value = field.getText() || undefined;
      } else if (field instanceof PDFCheckBox) {
        type = 'checkbox';
        value = field.isChecked() ? 'checked' : 'unchecked';
      }

      return { name, type, value };
    });

    logger.info(`Found ${fieldInfo.length} form fields in PDF`);
    return fieldInfo;
  } catch (error) {
    logger.error(`Failed to get PDF form fields: ${filePath}`, error as Error);
    throw new Error(
      `Failed to read form fields: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Assemble a proposal PDF from generated content
 * @param outputPath - Path where PDF will be saved
 * @param options - PDF assembly options including content sections
 * @returns Success status and output path
 */
export async function assembleProposalPDF(
  outputPath: string,
  options: PDFAssemblyOptions
): Promise<{ success: boolean; outputPath: string; pages: number }> {
  try {
    logger.info('Assembling proposal PDF', {
      outputPath,
      sectionCount: options.sections?.length || 0,
    });

    const pdfDoc = await PDFDocument.create();

    // Set metadata
    if (options.title) pdfDoc.setTitle(options.title);
    if (options.author) pdfDoc.setAuthor(options.author);
    if (options.subject) pdfDoc.setSubject(options.subject);
    if (options.keywords) pdfDoc.setKeywords(options.keywords);
    pdfDoc.setCreator('RFP Agent - Proposal Generator');
    pdfDoc.setProducer('pdf-lib');
    pdfDoc.setCreationDate(new Date());

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 612; // Letter size width
    const pageHeight = 792; // Letter size height
    const margin = 50;
    const maxWidth = pageWidth - 2 * margin;
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Helper function to add new page
    const addNewPage = () => {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
    };

    // Helper function to draw text with word wrapping
    const drawText = (
      text: string,
      fontSize: number,
      isBold: boolean = false
    ) => {
      const textFont = isBold ? boldFont : font;
      const lineHeight = fontSize * 1.2;
      const words = text.split(' ');
      let line = '';

      for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = textFont.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && line !== '') {
          // Check if we need a new page
          if (yPosition - lineHeight < margin) {
            addNewPage();
          }

          currentPage.drawText(line.trim(), {
            x: margin,
            y: yPosition,
            size: fontSize,
            font: textFont,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
          line = word + ' ';
        } else {
          line = testLine;
        }
      }

      // Draw remaining text
      if (line.trim() !== '') {
        if (yPosition - lineHeight < margin) {
          addNewPage();
        }

        currentPage.drawText(line.trim(), {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: textFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= lineHeight;
      }

      // Add extra spacing after paragraph
      yPosition -= lineHeight * 0.5;
    };

    // Add title if provided
    if (options.title) {
      drawText(options.title, 24, true);
      yPosition -= 20;
    }

    // Add sections
    if (options.sections) {
      for (const section of options.sections) {
        // Check if we need a new page before section
        if (section.includePageBreak) {
          addNewPage();
        }

        // Draw section heading
        drawText(section.heading, section.fontSize || 16, true);
        yPosition -= 10;

        // Draw section content
        const paragraphs = section.content.split('\n\n');
        for (const paragraph of paragraphs) {
          if (paragraph.trim()) {
            drawText(paragraph.trim(), 12, false);
          }
        }

        yPosition -= 10;
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);

    const pageCount = pdfDoc.getPageCount();

    logger.info('Successfully assembled proposal PDF', {
      outputPath,
      pages: pageCount,
    });

    return {
      success: true,
      outputPath,
      pages: pageCount,
    };
  } catch (error) {
    logger.error('Failed to assemble proposal PDF', error as Error);
    throw new Error(
      `PDF assembly failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Merge multiple PDFs into one
 * @param inputPaths - Array of PDF file paths to merge
 * @param outputPath - Path where merged PDF will be saved
 * @returns Success status and output path
 */
export async function mergePDFs(
  inputPaths: string[],
  outputPath: string
): Promise<{ success: boolean; outputPath: string; totalPages: number }> {
  try {
    logger.info('Merging PDFs', { inputCount: inputPaths.length, outputPath });

    const mergedPdf = await PDFDocument.create();
    let totalPages = 0;

    for (const inputPath of inputPaths) {
      const pdfBytes = fs.readFileSync(inputPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

      for (const page of copiedPages) {
        mergedPdf.addPage([page.getWidth(), page.getHeight() as number]);
        totalPages++;
      }

      logger.debug(`Merged PDF: ${inputPath}`, { pages: pdf.getPageCount() });
    }

    const mergedPdfBytes = await mergedPdf.save();
    fs.writeFileSync(outputPath, mergedPdfBytes);

    logger.info('Successfully merged PDFs', {
      outputPath,
      totalPages,
      inputCount: inputPaths.length,
    });

    return {
      success: true,
      outputPath,
      totalPages,
    };
  } catch (error) {
    logger.error('Failed to merge PDFs', error as Error);
    throw new Error(
      `PDF merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
