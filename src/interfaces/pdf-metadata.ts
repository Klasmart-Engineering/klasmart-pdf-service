import { PDFInternalOutlineRecord } from '../pdf/pdf-outline-builder';

interface KLPDFMetadata {
    outline: PDFInternalOutlineRecord[];
    pageLabels: string[];
    pageCount: number;
}
