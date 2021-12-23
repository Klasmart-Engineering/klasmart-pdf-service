import { PDFMetadata } from '../models/PDFMetadata';
import { PDFInternalOutlineTree } from '../pdf/pdf-outline-builder';

export interface PDFMetadataDTO {
    totalPages: number;
    outline?: PDFInternalOutlineTree;
    pageLabels?: string[]
}


export function mapModelToDTO(model: PDFMetadata): PDFMetadataDTO {
    return {
        totalPages: model.totalPages,
        outline: model.outline,
        pageLabels: model.pageLabels
    }
}