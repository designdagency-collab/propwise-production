declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      letterRendering?: boolean;
      scrollY?: number;
      logging?: boolean;
    };
    jsPDF?: {
      unit?: string;
      format?: string;
      orientation?: string;
    };
    pagebreak?: { mode?: string | string[] };
  }

  interface Html2Pdf {
    set(options: Html2PdfOptions): Html2Pdf;
    from(element: HTMLElement | string): Html2Pdf;
    save(filename?: string): Promise<void>;
    toPdf(): Html2Pdf;
    output(type: string, options?: any): any;
  }

  function html2pdf(element?: HTMLElement, options?: Html2PdfOptions): Html2Pdf;
  export default html2pdf;
}
