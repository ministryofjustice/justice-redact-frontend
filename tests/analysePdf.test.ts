
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    analysePdf,
} from "../features/documents/upload/analysePdf";

/*
 * Mock PDF.js so these tests exercise Justice Redact's
 * analysis rules without needing real PDF documents,
 * a browser PDF worker or external services.
 */
const pdfJsMock = vi.hoisted(() => ({
    getDocument: vi.fn(),
    OPS: {
        paintImageXObject: 101,
        paintInlineImageXObject: 102,
        paintImageXObjectRepeat: 103,
    },
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
    getDocument: pdfJsMock.getDocument,
    OPS: pdfJsMock.OPS,
    GlobalWorkerOptions: {
        workerSrc: "",
    },
}));

function createFile(): File {
    return {
        arrayBuffer: vi.fn(
            async () => new ArrayBuffer(8),
        ),
    } as unknown as File;
}

/*
 * PDF.js text coordinates are represented by the
 * sixth element of an item's transform array.
 *
 * For a 1,000-unit-high page, y=500 is within the
 * existing body-text boundaries.
 */
function createPage(
    lines: string[] = [],
    hasImage = false,
    y = 500,
) {
    return {
        getViewport: vi.fn(() => ({
            height: 1000,
        })),

        getTextContent: vi.fn(async () => ({
            items: lines.map((str) => ({
                str,
                transform: [1, 0, 0, 1, 0, y],
            })),
        })),

        getOperatorList: vi.fn(async () => ({
            fnArray: hasImage
                ? [pdfJsMock.OPS.paintImageXObject]
                : [],
        })),

        cleanup: vi.fn(),
    };
}

type MockPage = ReturnType<typeof createPage>;

/*
 * Supply a predictable PDF.js loading task.
 *
 * Each test can control the page contents and
 * inspect whether resources were cleaned up.
 */
function mockPdf(
    pages: MockPage[],
    metadataTitle = "",
) {
    const getPage = vi.fn(
        async (pageNumber: number) => {
            const page = pages[pageNumber - 1];

            if (!page) {
                throw new Error(
                    `Page ${pageNumber} not found`,
                );
            }

            return page;
        },
    );

    const getMetadata = vi.fn(async () => ({
        info: {
            Title: metadataTitle,
        },
    }));

    const destroy = vi.fn(async () => { });

    pdfJsMock.getDocument.mockReturnValue({
        promise: Promise.resolve({
            numPages: pages.length,
            getPage,
            getMetadata,
        }),
        destroy,
    });

    return {
        getPage,
        getMetadata,
        destroy,
    };
}

describe("analysePdf", () => {
    beforeEach(() => {
        pdfJsMock.getDocument.mockReset();
    });

    it("identifies NOMIS from text on the first page", async () => {
        mockPdf([
            createPage([
                "NOMIS Subject Access Request",
                "Prisoner information",
            ]),
        ]);

        await expect(
            analysePdf(createFile()),
        ).resolves.toEqual({
            hasBodyText: true,
            mightBeScannedDocument: false,
            documentType: "nomis",
        });
    });

    it("identifies NOMIS from a Module: SAR_ marker on a sampled page", async () => {
        mockPdf([
            createPage(["Ordinary case notes"]),
            createPage(["Module: SAR_PRISONER"]),
        ]);

        const result = await analysePdf(
            createFile(),
        );

        expect(result.documentType).toBe("nomis");
    });

    it("identifies DPS using the first-page indicators", async () => {
        mockPdf([
            createPage([
                "Location",
                "Category",
                "CSRA",
                "Incentive level",
            ]),
        ]);

        const result = await analysePdf(
            createFile(),
        );

        expect(result.documentType).toBe("dps");
    });

    it("identifies DPS from PDF metadata title", async () => {
        mockPdf(
            [
                createPage([
                    "Ordinary case note",
                ]),
            ],
            "DPS Case Notes",
        );

        const result = await analysePdf(
            createFile(),
        );

        expect(result.documentType).toBe("dps");
    });

    it("identifies DPS using Created by and Happened indicators", async () => {
        mockPdf([
            createPage([
                "Created by: Example Officer",
            ]),
            createPage([
                "Happened: Example event",
            ]),
        ]);

        const result = await analysePdf(
            createFile(),
        );

        expect(result.documentType).toBe("dps");
    });

    it("prioritises NOMIS when both NOMIS and DPS indicators exist", async () => {
        mockPdf([
            createPage([
                "NOMIS Subject Access Request",
                "Location Category CSRA Incentive level",
            ]),
        ]);

        const result = await analysePdf(
            createFile(),
        );

        expect(result.documentType).toBe("nomis");
    });

    it("returns unidentified when no supported document indicators exist", async () => {
        mockPdf([
            createPage([
                "An ordinary document",
                "Some unrelated text",
            ]),
        ]);

        const result = await analysePdf(
            createFile(),
        );

        expect(result.documentType).toBe(
            "unidentified",
        );

        expect(
            result.mightBeScannedDocument,
        ).toBe(false);
    });

    it("detects a potentially scanned document when every sampled page contains an image and little text", async () => {
        mockPdf([
            createPage([], true),
            createPage([], true),
            createPage([], true),
        ]);

        const result = await analysePdf(
            createFile(),
        );

        expect(
            result.mightBeScannedDocument,
        ).toBe(true);
    });

    it("does not classify a document as scanned when only some sampled pages contain images", async () => {
        mockPdf([
            createPage([], true),
            createPage(["Ordinary body text"]),
        ]);

        const result = await analysePdf(
            createFile(),
        );

        expect(
            result.mightBeScannedDocument,
        ).toBe(false);
    });

    it("skips expensive image inspection after accumulating at least 500 body-text characters", async () => {
        const page = createPage([
            "A".repeat(520),
        ]);

        mockPdf([page]);

        const result = await analysePdf(
            createFile(),
        );

        expect(
            result.mightBeScannedDocument,
        ).toBe(false);

        expect(
            page.getOperatorList,
        ).not.toHaveBeenCalled();
    });

    it("samples the first 10 pages and 10 distributed pages in a 100-page document", async () => {
        const pages = Array.from(
            { length: 100 },
            () => createPage(["Ordinary text"]),
        );

        const { getPage } = mockPdf(pages);

        await analysePdf(createFile());

        const inspectedPages =
            getPage.mock.calls.map(
                ([pageNumber]) => pageNumber,
            );

        expect(inspectedPages).toEqual([
            1, 2, 3, 4, 5,
            6, 7, 8, 9, 10,
            19, 28, 37, 46, 55,
            64, 73, 82, 91, 100,
        ]);

        expect(getPage).toHaveBeenCalledTimes(20);

        for (const pageNumber of inspectedPages) {
            expect(
                pages[pageNumber - 1].cleanup,
            ).toHaveBeenCalledOnce();
        }
    });

    it("excludes text outside the body region from the scanned-document text threshold", async () => {
        const page = createPage(
            ["A".repeat(600)],
            true,
            900,
        );

        mockPdf([page]);

        const result = await analysePdf(
            createFile(),
        );

        expect(
            page.getOperatorList,
        ).toHaveBeenCalledOnce();

        expect(
            result.mightBeScannedDocument,
        ).toBe(true);
    });

    it("continues analysis when PDF metadata cannot be read", async () => {
        const page = createPage([
            "Ordinary body text",
        ]);

        const pdf = mockPdf([page]);

        pdf.getMetadata.mockRejectedValueOnce(
            new Error("Metadata unavailable"),
        );

        const result = await analysePdf(
            createFile(),
        );

        expect(result.documentType).toBe(
            "unidentified",
        );

        expect(pdf.destroy).toHaveBeenCalledOnce();
    });

    it("cleans up page and document resources when text extraction fails", async () => {
        const page = createPage([
            "NOMIS",
        ]);

        page.getTextContent.mockRejectedValueOnce(
            new Error("Text extraction failed"),
        );

        const pdf = mockPdf([page]);

        await expect(
            analysePdf(createFile()),
        ).rejects.toThrow(
            "Text extraction failed",
        );

        expect(
            page.cleanup,
        ).toHaveBeenCalledOnce();

        expect(
            pdf.destroy,
        ).toHaveBeenCalledOnce();
    });

    it("does not discard a successful analysis when PDF.js cleanup fails", async () => {
        const page = createPage([
            "NOMIS Subject Access Request",
        ]);

        const pdf = mockPdf([page]);

        pdf.destroy.mockRejectedValueOnce(
            new Error("Cleanup failed"),
        );

        const warningSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => { });

        try {
            const result = await analysePdf(
                createFile(),
            );

            expect(result.documentType).toBe(
                "nomis",
            );

            expect(
                warningSpy,
            ).toHaveBeenCalledWith(
                "Failed to clean up PDF.js loading task",
                expect.any(Error),
            );
        } finally {
            warningSpy.mockRestore();
        }
    });
});
