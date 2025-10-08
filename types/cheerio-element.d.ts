declare module 'cheerio' {
  import { type Element, type AnyNode } from 'domhandler';

  export type { Element, AnyNode };

  export interface Cheerio<T = AnyNode> extends ArrayLike<T> {
    length: number;
    [index: number]: T;
    cheerio: '[cheerio object]';
    eq(index: number): Cheerio<T>;
    first(): Cheerio<T>;
    last(): Cheerio<T>;
    slice(start?: number, end?: number): Cheerio<T>;
    find<S extends AnyNode>(selector: string): Cheerio<S>;
    text(): string;
    text(value: string): this;
    html(): string | null;
    html(value: string): this;
    attr(name: string): string | undefined;
    attr(name: string, value: string): this;
    addClass(value: string): this;
    removeClass(value: string): this;
    hasClass(value: string): boolean;
    each(fn: (index: number, element: T) => void | boolean): this;
    closest(selector: string): Cheerio<T>;
    parent(): Cheerio<T>;
    filter(selector: string | ((index: number, element: T) => boolean)): Cheerio<T>;
  }

  export interface CheerioAPI {
    (selector: string, context?: string | Cheerio | AnyNode | AnyNode[]): Cheerio<Element>;
    (element: string | Cheerio | AnyNode | AnyNode[]): Cheerio<Element>;
    load(content: string, options?: Record<string, unknown>): CheerioAPI;
    html(): string;
    html(element: string | Cheerio | AnyNode): string;
    html(element: string | Cheerio | AnyNode, htmlString: string): CheerioAPI;
    text(element: Cheerio | AnyNode | AnyNode[]): string;
    root(): Cheerio<Element>;
  }

  export function load(content: string, options?: Record<string, unknown>): CheerioAPI;
}

declare module 'cheerio/dist/esm/index.js' {
  export * from 'cheerio';
}

declare module 'cheerio/dist/esm/index' {
  export * from 'cheerio';
}
