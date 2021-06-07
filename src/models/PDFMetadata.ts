import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class PDFMetadata {
    
    @PrimaryGeneratedColumn("uuid")
    id: string;

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

    constructor(id: string, totalPages: number, pagesGenerated: number) {
        this.id = id;
        this.totalPages = totalPages;
        this.pagesGenerated = pagesGenerated;
    }
}