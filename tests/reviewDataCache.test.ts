import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import type { ReviewPageData } from "../app/review/types";

vi.mock("../app/lib/api", () => ({
    fetchJson: vi.fn(),
}));

import { fetchJson } from "../app/lib/api";
import {
    clearCachedReviewData,
    getCachedReviewSearchPages,
    loadReviewSearchPages,
} from "../app/review/reviewDataCache";

const mockedFetchJson = vi.mocked(fetchJson);

describe("review search data cache", () => {
    const documentId = "document-123";

    beforeEach(() => {
        process.env.NEXT_PUBLIC_API_BASE_URL =
            "https://api.example.test";

        clearCachedReviewData(documentId);
        mockedFetchJson.mockReset();
    });

    afterEach(() => {
        clearCachedReviewData(documentId);
    });

    it("loads search pages once and reuses them from the cache", async () => {
        const pages: ReviewPageData[] = [];

        mockedFetchJson.mockResolvedValue({
            pages,
        });

        const firstResult =
            await loadReviewSearchPages(documentId);

        expect(mockedFetchJson).toHaveBeenCalledTimes(1);

        expect(mockedFetchJson).toHaveBeenCalledWith(
            "https://api.example.test/documents/document-123/review/search",
            {
                cache: "no-store",
            }
        );

        expect(firstResult).toBe(pages);

        expect(
            getCachedReviewSearchPages(documentId)
        ).toBe(pages);

        const secondResult =
            await loadReviewSearchPages(documentId);

        expect(secondResult).toBe(pages);

        expect(mockedFetchJson).toHaveBeenCalledTimes(1);
    });
});