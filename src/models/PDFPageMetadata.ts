import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { PDFMetadata } from './PDFMetadata';

@Entity()
export class PDFPageMetadata {
    
    @PrimaryColumn()
    pageLocation: string;

    @Column({ nullable: false })
    pageNumber: number;

    @ManyToOne(() => PDFMetadata, metadata => metadata.pages, {eager: true})
    PDFMetadata: PDFMetadata;

    @Column({default: false})
    loaded: boolean;

    constructor(pageLocation: string, pageNumber: number, pdfMetadata: PDFMetadata, loaded = false) {
        this.pageLocation = pageLocation;
        this.pageNumber = pageNumber;
        this.PDFMetadata = pdfMetadata;
        this.loaded = loaded;
    }
}