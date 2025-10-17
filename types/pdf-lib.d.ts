declare module 'pdf-lib' {
  export class PDFDocument {
    static create(): Promise<PDFDocument>;
    static load(pdfBytes: Uint8Array | ArrayBuffer): Promise<PDFDocument>;

    getForm(): PDFForm;
    getPages(): PDFPage[];
    getPageCount(): number;
    addPage(size?: [number, number]): PDFPage;
    copyPages(srcDoc: PDFDocument, indices: number[]): Promise<PDFPage[]>;
    getPageIndices(): number[];

    setTitle(title: string): void;
    setAuthor(author: string): void;
    setSubject(subject: string): void;
    setKeywords(keywords: string[]): void;
    setProducer(producer: string): void;
    setCreator(creator: string): void;
    setCreationDate(date: Date): void;
    setModificationDate(date: Date): void;

    save(options?: { useObjectStreams?: boolean }): Promise<Uint8Array>;
    saveAsBase64(): Promise<string>;

    embedFont(font: string): Promise<PDFFont>;
    embedPdf(pdfBytes: Uint8Array): Promise<PDFDocument>;
  }

  export class PDFForm {
    getFields(): PDFField[];
    getTextField(name: string): PDFTextField;
    getCheckBox(name: string): PDFCheckBox;
    getRadioGroup(name: string): PDFRadioGroup;
    getDropdown(name: string): PDFDropdown;
    flatten(): void;
  }

  export abstract class PDFField {
    getName(): string;
    isReadOnly(): boolean;
    setReadOnly(readonly: boolean): void;
  }

  export class PDFTextField extends PDFField {
    getText(): string | undefined;
    setText(text: string): void;
    setMaxLength(maxLength: number): void;
    setAlignment(alignment: number): void;
    enableMultiline(): void;
    disableMultiline(): void;
  }

  export class PDFCheckBox extends PDFField {
    check(): void;
    uncheck(): void;
    isChecked(): boolean;
  }

  export class PDFRadioGroup extends PDFField {
    select(option: string): void;
    clear(): void;
    getSelected(): string | undefined;
    getOptions(): string[];
  }

  export class PDFDropdown extends PDFField {
    select(option: string): void;
    clear(): void;
    getSelected(): string[];
    getOptions(): string[];
  }

  export class PDFPage {
    getWidth(): number;
    getHeight(): number;
    drawText(text: string, options?: TextOptions): void;
    drawRectangle(options?: RectangleOptions): void;
    drawLine(options?: LineOptions): void;
    drawImage(image: PDFImage, options?: ImageOptions): void;
    setFont(font: PDFFont): void;
  }

  export class PDFFont {
    widthOfTextAtSize(text: string, size: number): number;
    heightAtSize(size: number): number;
  }

  export class PDFImage {
    scale(factor: number): PDFImage;
    scaleToFit(width: number, height: number): PDFImage;
  }

  export interface TextOptions {
    x: number;
    y: number;
    size?: number;
    font?: PDFFont;
    color?: RGB;
    opacity?: number;
    rotate?: { angle: number; type?: number };
    maxWidth?: number;
    lineHeight?: number;
  }

  export interface RectangleOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: RGB;
    borderColor?: RGB;
    borderWidth?: number;
    opacity?: number;
  }

  export interface LineOptions {
    start: { x: number; y: number };
    end: { x: number; y: number };
    thickness?: number;
    color?: RGB;
    opacity?: number;
  }

  export interface ImageOptions {
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotate?: { angle: number; type?: number };
    opacity?: number;
  }

  export interface RGB {
    red: number;
    green: number;
    blue: number;
  }

  export function rgb(red: number, green: number, blue: number): RGB;

  export enum StandardFonts {
    Courier = 'Courier',
    CourierBold = 'Courier-Bold',
    CourierOblique = 'Courier-Oblique',
    CourierBoldOblique = 'Courier-BoldOblique',
    Helvetica = 'Helvetica',
    HelveticaBold = 'Helvetica-Bold',
    HelveticaOblique = 'Helvetica-Oblique',
    HelveticaBoldOblique = 'Helvetica-BoldOblique',
    TimesRoman = 'Times-Roman',
    TimesRomanBold = 'Times-Bold',
    TimesRomanItalic = 'Times-Italic',
    TimesRomanBoldItalic = 'Times-BoldItalic',
    Symbol = 'Symbol',
    ZapfDingbats = 'ZapfDingbats',
  }

  export const PageSizes: Record<string, [number, number]>;

  export const degrees: (angle: number) => { angle: number; type: number };
  export const radians: (angle: number) => { angle: number; type: number };
}
