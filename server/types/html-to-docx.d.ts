declare module 'html-to-docx' {
  interface HTMLtoDOCXOptions {
    table?: { row?: { cantSplit?: boolean } };
    footer?: boolean;
    pageNumber?: boolean;
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  }

  function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString: string | null,
    options?: HTMLtoDOCXOptions
  ): Promise<Buffer>;

  export default HTMLtoDOCX;
}
