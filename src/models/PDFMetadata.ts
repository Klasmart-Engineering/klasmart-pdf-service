import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { PDFPageMetadata } from './PDFPageMetadata';

@Entity()
export class PDFMetadata {
    
    /** Unique S3 Key name of PDF */
    @PrimaryColumn('varchar')
    pdfLocation: string;

    /* Total pages that the PDF contains */
    @Column({
        type: 'integer',
        nullable: false
    })
    totalPages: number;
    
    /* Total pages that have had images generated from them and stored in S3 */
    @Column({
        default: 0,
        type: 'integer',
        nullable: false
    })
    pagesGenerated: number;

    @OneToMany(() => PDFPageMetadata, pageMetadata => pageMetadata.PDFMetadata)
    pages: PDFPageMetadata[];

    constructor(pdfLocation: string, totalPages: number, pagesGenerated: number, pages: PDFPageMetadata[]) {
        this.pdfLocation = pdfLocation;
        this.totalPages = totalPages;
        this.pagesGenerated = pagesGenerated;
        this.pages = pages;
    }
}
