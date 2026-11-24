
const MINIMUM_BODY_CHARACTERS = 0;
const MAX_VALIDATION_PAGES = 20;
const LEADING_VALIDATION_PAGES = 10;

export type DocumentType =
    | "nomis"
    | "dps"
    | "unidentified";

export type PdfAnalysisResult = {
    hasBodyText: boolean;
    mightBeScannedDocument: boolean;
    documentType: DocumentType;
};

function normaliseText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function getValidationPageNumbers(
    totalPages: number,
): number[] {
    if (totalPages <= MAX_VALIDATION_PAGES) {
        return Array.from(
            { length: totalPages },
            (_, index) => index + 1,
        );
    }

    const pageNumbers = new Set<number>();

    const leadingPageCount = Math.min(
        LEADING_VALIDATION_PAGES,
        totalPages,
    );

    for (
        let pageNumber = 1;
        pageNumber <= leadingPageCount;
        pageNumber += 1
    ) {
        pageNumbers.add(pageNumber);
    }

    const remainingSampleCount =
        MAX_VALIDATION_PAGES - leadingPageCount;

    for (
        let index = 1;
        index <= remainingSampleCount;
        index += 1
    ) {
        const pageNumber =
            leadingPageCount +
            Math.round(
                ((totalPages - leadingPageCount) * index) /
                remainingSampleCount,
            );

        pageNumbers.add(
            Math.min(totalPages, pageNumber),
        );
    }

    return Array.from(pageNumbers).sort(
        (left, right) => left - right,
    );
}

export async function analysePdf(
    file: File,
): Promise<PdfAnalysisResult> {
    const pdfjsLib = await import(
        "pdfjs-dist/legacy/build/pdf.mjs"
    );

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "/pdf.worker.min.mjs";

    const buffer = await file.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({
        data: buffer,
    });

    try {
        const pdf = await loadingTask.promise;

        const metadata = await pdf
            .getMetadata()
            .catch(() => null);

        const metadataTitle =
            "info" in (metadata ?? {}) &&
                metadata?.info &&
                "Title" in metadata.info &&
                typeof metadata.info.Title === "string"
                ? metadata.info.Title
                : "";

        const firstPageLines: string[] = [];
        const sampledDocumentLines: string[] = [];

        let bodyTextLength = 0;
        let sampledPagesWithImages = 0;

        const validationPageNumbers =
            getValidationPageNumbers(
                pdf.numPages,
            );

        for (
            const pageNumber of validationPageNumbers
        ) {
            const page =
                await pdf.getPage(pageNumber);

            try {
                const viewport =
                    page.getViewport({
                        scale: 1,
                    });

                const textContent =
                    await page.getTextContent();

                const pageLines = textContent.items
                    .map((item) => {
                        if (
                            !("str" in item) ||
                            typeof item.str !== "string"
                        ) {
                            return null;
                        }

                        const text =
                            normaliseText(item.str);

                        const y =
                            Array.isArray(item.transform)
                                ? item.transform[5]
                                : undefined;

                        if (
                            !text ||
                            typeof y !== "number"
                        ) {
                            return null;
                        }

                        return {
                            text,
                            y,
                        };
                    })
                    .filter(
                        (
                            item,
                        ): item is {
                            text: string;
                            y: number;
                        } => item !== null,
                    );

                const pageTextLines =
                    pageLines.map(
                        ({ text }) => text,
                    );

                sampledDocumentLines.push(
                    ...pageTextLines,
                );

                if (pageNumber === 1) {
                    firstPageLines.push(
                        ...pageTextLines,
                    );
                }

                const topBoundary =
                    viewport.height * 0.85;

                const bottomBoundary =
                    viewport.height * 0.15;

                const meaningfulBodyLines =
                    pageLines
                        .filter(
                            ({ y }) =>
                                y < topBoundary &&
                                y > bottomBoundary,
                        )
                        .map(
                            ({ text }) => text,
                        )
                        .filter((line) => {
                            const isTooShort =
                                line.length < 3;

                            const isPageNumber =
                                /^\d+$/.test(line);

                            const hasWords =
                                /[a-zA-Z]{2,}/.test(
                                    line,
                                );

                            return (
                                !isTooShort &&
                                !isPageNumber &&
                                hasWords
                            );
                        });

                bodyTextLength +=
                    meaningfulBodyLines.join(
                        " ",
                    ).length;

                if (bodyTextLength < 500) {
                    const operatorList =
                        await page.getOperatorList();

                    const pageHasImage =
                        operatorList.fnArray.some(
                            (fn) =>
                                fn ===
                                pdfjsLib.OPS
                                    .paintImageXObject ||
                                fn ===
                                pdfjsLib.OPS
                                    .paintInlineImageXObject ||
                                fn ===
                                pdfjsLib.OPS
                                    .paintImageXObjectRepeat,
                        );

                    if (pageHasImage) {
                        sampledPagesWithImages += 1;
                    }
                }
            } finally {
                page.cleanup();
            }
        }

        const firstPageText =
            normaliseText(
                firstPageLines.join(" "),
            ).toLowerCase();

        const sampledDocumentText =
            normaliseText(
                sampledDocumentLines.join(" "),
            ).toLowerCase();

        const title =
            metadataTitle.toLowerCase();

        const isNomisDocument =
            firstPageText.includes("nomis") ||
            firstPageText.includes("noms") ||
            sampledDocumentText.includes(
                "module: sar_",
            );

        const isDpsDocument =
            (
                firstPageText.includes(
                    "location",
                ) &&
                firstPageText.includes(
                    "category",
                ) &&
                firstPageText.includes(
                    "csra",
                ) &&
                firstPageText.includes(
                    "incentive level",
                )
            ) ||
            title.includes("dps") ||
            (
                sampledDocumentText.includes(
                    "created by:",
                ) &&
                sampledDocumentText.includes(
                    "happened:",
                )
            );

        const hasBodyText =
            bodyTextLength >=
            MINIMUM_BODY_CHARACTERS;

        const mightBeScannedDocument =
            bodyTextLength < 500 &&
            validationPageNumbers.length > 0 &&
            sampledPagesWithImages ===
            validationPageNumbers.length;

        const documentType: DocumentType =
            isNomisDocument
                ? "nomis"
                : isDpsDocument
                    ? "dps"
                    : "unidentified";

        return {
            hasBodyText,
            mightBeScannedDocument,
            documentType,
        };
    } finally {
        try {
            await loadingTask.destroy();
        } catch (cleanupError) {
            console.warn(
                "Failed to clean up PDF.js loading task",
                cleanupError,
            );
        }
    }
}
