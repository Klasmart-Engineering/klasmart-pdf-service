import { Column, Entity, PrimaryColumn } from 'typeorm';
import { PDFInternalOutlineTree } from '../pdf/pdf-outline-builder';

@Entity({
    name: 'pdf_metadata'
})
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
    
    /**
     * Array of Outline Item nodes that can each contain nested items.
     * Used to build a document outline for documents that contain the 
     * outline document.
     * 
     * Note that this format is slightly modified from the core PDF
     * specification to include the page number for outline items when
     * the required metadata is provided.
     */
    @Column({
        type: 'jsonb',
        nullable: true
    })
    outline: PDFInternalOutlineTree | undefined;

    /**
     * Array of page labels that can be used as a substitute for default ordinal
     * page numbering.  Often used to provide alternative numbering for pages that
     * are not a part of a documents primary content (ie: Roman numerals for prefix)
     */
    @Column({
        type: 'jsonb',
        nullable: true
    })
    pageLabels: string[] | undefined;


    constructor(
        pdfLocation: string,
        totalPages: number,
        pagesGenerated: number,
        outline: PDFInternalOutlineTree | undefined,
        pageLabels: string[] | undefined
    ) {
        this.pdfLocation = pdfLocation;
        this.totalPages = totalPages;
        this.pagesGenerated = pagesGenerated;
        this.outline = outline;
        this.pageLabels = pageLabels;
    }
}
