export interface ValidationStatus {
    key: string;
    validationComplete: boolean;
    valid: undefined | boolean;
    totalPages: undefined | number;
    pagesValidated: undefined | number;
}
