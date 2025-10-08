declare module 'pdf-parse' {
  interface PDFInfo {
    [key: string]: unknown;
  }

  interface PDFMetadata {
    [key: string]: unknown;
  }

  interface PDFTextItem {
    text: string;
    [key: string]: unknown;
  }

  interface PDFParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata: PDFMetadata | null;
    version: string;
    textContent?: PDFTextItem[];
  }

  type PDFBuffer = Buffer | Uint8Array | ArrayBuffer;

  export interface PDFParseOptions {
    pagerender?(data: { getTextContent(): Promise<unknown> }): Promise<string | void>;
    max?: number;
  }

  export default function pdfParse(
    data: PDFBuffer,
    options?: PDFParseOptions
  ): Promise<PDFParseResult>;
}
