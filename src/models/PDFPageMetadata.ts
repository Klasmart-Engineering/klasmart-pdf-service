import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { PDFMetadata } from './PDFMetadata';

@Entity({
    name: 'pdf_page_metadata'
})
export class PDFPageMetadata {
    
    @PrimaryColumn('varchar')
    pageLocation: string;

    @Column({ type: 'integer', nullable: false })
    pageNumber: number;

    @ManyToOne(() => PDFMetadata, metadata => metadata.pages, {eager: true})
    PDFMetadata: PDFMetadata;

    @Column('boolean', {default: false})
    loaded: boolean;

    constructor(pageLocation: string, pageNumber: number, pdfMetadata: PDFMetadata, loaded = false) {
        this.pageLocation = pageLocation;
        this.pageNumber = pageNumber;
        this.PDFMetadata = pdfMetadata;
        this.loaded = loaded;
    }
}