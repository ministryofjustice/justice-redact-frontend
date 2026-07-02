export type ReviewBBox = { x0: number; y0: number; x1: number; y1: number };

export type ReviewTextItem = {
    itemId: string;
    text: string;
    renderText: string;
    bbox: ReviewBBox | null;
};

export type ReviewTableCell = {
    cellId: string;
    tableId: string;
    rowIndex: number;
    colIndex: number;
    text: string;
    renderText: string;
    bbox: ReviewBBox | null;
    isHeader: boolean;
    isNumeric: boolean;
};

export type ReviewTableRow = { rowIndex: number; cells: ReviewTableCell[] };

export type ReviewTable = {
    tableId: string;
    bbox: ReviewBBox | null;
    rows: ReviewTableRow[];
};

export type ReviewImage = {
    imageId: string;
    imageRecordId: string | null;
    imageUrl: string | null;
    alt: string | null;
    bbox: ReviewBBox | null;
};

export type ReviewPageData = {
    pageNumber: number;
    pageId?: string;
    textItems: ReviewTextItem[];
    tables: ReviewTable[];
    images: ReviewImage[];
};

export type ReviewFinding = {
    id: string;
    kind: "text" | "table_cell" | "image";
    pageNumber: number;
    itemId: string | null;
    tableId: string | null;
    cellId: string | null;
    imageId: string | null;
    imageRecordId: string | null;
    entityType: string;
    entityText: string;
    entityStart: number | null;
    entityEnd: number | null;
    entityScore: number;
    context: string;
    decision: string;
    sectionLabel: string | null;
};

export type ReviewResponse = {
    documentId: string;
    filename: string;
    status: string;
    pages: ReviewPageData[];
    findings: ReviewFinding[];
    subjectDetails: {
        subjectName: string;
        subjectPrisonNumber: string;
        otherPhrases: string[];
    };
    summary: {
        totalPages: number;
        totalTextItems?: number;
        totalFindings: number;
    };
};

export type PageContentBlock =
    | { kind: "text"; y: number; item: ReviewTextItem }
    | { kind: "table"; y: number; table: ReviewTable }
    | { kind: "image"; y: number; image: ReviewImage };

export type ManualTextDecision = {
    id: string;
    documentId: string;
    kind: "text";
    pageNumber: number;
    itemId: string;
    start: number;
    end: number;
    text: string;
};

export type ManualTableCellDecision = {
    id: string;
    documentId: string;
    kind: "table_cell";
    pageNumber: number;
    tableId: string;
    cellId: string;
    start: number;
    end: number;
    text: string;
};

export type ManualImageDecision = {
    id: string;
    documentId: string;
    kind: "image";
    pageNumber: number;
    imageId: string;
};

export type ManualDecision =
    | ManualTextDecision
    | ManualTableCellDecision
    | ManualImageDecision;

export type RenderRange = {
    start: number;
    end: number;
    className: string;
    key: string;
    manualId?: string;
};

export type ManualSpan = {
    pageNumber: number;
    itemId: string;
    start: number;
    end: number;
};

export type PageStatus = "deleted" | "exempted";