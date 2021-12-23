import { PDFDocumentProxy, RefProxy } from 'pdfjs-dist/types/src/display/api';

export type PDFOutlineTree = PDFOutlineItem[];
export type PDFInternalOutlineTree = PDFInternalOutlineRecord[];

/* eslint @typescript-eslint/no-explicit-any: "off" */
// Ignoring explicit any to allow for interface definitions based on
// pdf.js types that contain any

interface PDFOutlineItem {
    title: string;
    bold: boolean;
    italic: boolean;
    color: Uint8ClampedArray;
    dest: string | any[] | null;
    url: string | null;
    unsafeUrl: string | undefined;
    newWindow: boolean | undefined;
    count: number | undefined;
    items: any[];
}

export interface PDFInternalOutlineRecord {
    title: string;
    bold: boolean;
    italic: boolean;
    color: Uint8ClampedArray;
    page: number;
    dest: string | any[] | undefined;
    url: string | undefined;
    unsafeUrl: string | undefined;
    newWindow: boolean | undefined;
    count: number | undefined;
    items: PDFInternalOutlineRecord[];
}

export async function retrieveDocumentOutline(document: PDFDocumentProxy): Promise<PDFOutlineTree> {
    return document.getOutline();
}

export async function mapDestinationToPage(document: PDFDocumentProxy, ref: RefProxy): Promise<number> {
    return document.getPageIndex(ref);
}

export async function getAdaptedOutline(document: PDFDocumentProxy): Promise<PDFInternalOutlineTree | undefined> {
    const outline = await retrieveDocumentOutline(document);
    
    // Did the document have an outline?
    if (!outline) {
        return undefined;
    }
    
    // This process will recurse through tree and convert the shape of the object to match PDFInternalOutlineTree
    outline.forEach(tree => 
        recurseRecord<void>(tree, (record: PDFOutlineItem) => adaptRecord(document, record))
    );

    return outline as PDFInternalOutlineTree;
}

/** 
 * Recursively applies a function to records
 * 
 * Recursive DFS approach
 */
export async function recurseRecord<T>(outline: PDFOutlineItem, f: (record: PDFOutlineItem) => T): Promise<void> {
    
    if (outline.items) {
        outline.items.forEach(item => {
            recurseRecord(item, f);
        })
    }

    f(outline)
}

/**
 * In place conversion of PDFOutlineItem to PDFInternalOutlineRecord
 * @param document - PDF document - Needed for retrieving the page number for destinations
 * @param record 
 * @returns 
 */
async function adaptRecord(document: PDFDocumentProxy, record: PDFOutlineItem): Promise<void> {
    if (!record.dest) {
        return;
    }
    const page = await mapDestinationToPage(document, record.dest[0]);
    
    const retypedRecord = record as PDFInternalOutlineRecord;

    retypedRecord.page = page;
    retypedRecord.dest ||= undefined;
    retypedRecord.url ||= undefined;
}
