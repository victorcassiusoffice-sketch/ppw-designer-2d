/// <reference types="vite/client" />

declare module 'jspdf' {
  export interface jsPDFOptions {
    orientation?: 'portrait' | 'landscape' | 'p' | 'l';
    unit?: 'pt' | 'mm' | 'cm' | 'in' | 'px';
    format?: string | number[];
    compress?: boolean;
    precision?: number;
    putOnlyUsedFonts?: boolean;
    hotfixes?: string[];
  }

  export class jsPDF {
    constructor(options?: jsPDFOptions);
    constructor(
      orientation?: 'portrait' | 'landscape' | 'p' | 'l',
      unit?: 'pt' | 'mm' | 'cm' | 'in' | 'px',
      format?: string | number[],
    );

    internal: {
      pageSize: {
        getWidth(): number;
        getHeight(): number;
        width: number;
        height: number;
      };
    };

    addPage(): jsPDF;
    setFont(fontName: string, fontStyle?: string): jsPDF;
    setFontSize(size: number): jsPDF;
    setTextColor(r: number, g?: number, b?: number): jsPDF;
    setFillColor(r: number, g?: number, b?: number): jsPDF;
    setDrawColor(r: number, g?: number, b?: number): jsPDF;
    setLineWidth(w: number): jsPDF;
    text(
      text: string | string[],
      x: number,
      y: number,
      options?: { align?: 'left' | 'center' | 'right'; baseline?: string; maxWidth?: number },
    ): jsPDF;
    rect(x: number, y: number, w: number, h: number, style?: 'S' | 'F' | 'DF' | 'FD'): jsPDF;
    roundedRect(
      x: number,
      y: number,
      w: number,
      h: number,
      rx: number,
      ry: number,
      style?: 'S' | 'F' | 'DF' | 'FD',
    ): jsPDF;
    line(x1: number, y1: number, x2: number, y2: number): jsPDF;
    addImage(
      imageData: string | HTMLImageElement | HTMLCanvasElement | Uint8Array,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number,
      alias?: string,
      compression?: 'NONE' | 'FAST' | 'MEDIUM' | 'SLOW',
      rotation?: number,
    ): jsPDF;
    getNumberOfPages(): number;
    output(type: 'blob'): Blob;
    output(type: 'arraybuffer'): ArrayBuffer;
    output(type: 'datauristring' | 'dataurlstring' | 'dataurl' | 'datauri'): string;
    output(type: 'string'): string;
    save(filename?: string): jsPDF;
  }

  export default jsPDF;
}

declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  export interface UserOptions {
    startY?: number;
    head?: (string | number)[][];
    body?: (string | number)[][];
    foot?: (string | number)[][];
    theme?: 'striped' | 'grid' | 'plain';
    headStyles?: Record<string, unknown>;
    bodyStyles?: Record<string, unknown>;
    footStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    columnStyles?: Record<string | number, unknown>;
    styles?: Record<string, unknown>;
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    didDrawPage?: (data: unknown) => void;
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): void;
}
