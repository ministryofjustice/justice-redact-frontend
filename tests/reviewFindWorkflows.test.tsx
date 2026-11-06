// @vitest-environment jsdom

import {
    act,
    renderHook,
} from "@testing-library/react";

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    useReviewFindWorkflows,
} from "../features/documents/review/useReviewFindWorkflows";

import type {
    ReviewPageData,
} from "../app/review/types";

const cacheMocks = vi.hoisted(() => ({
    getCachedReviewSearchPages: vi.fn(),
    loadReviewSearchPages: vi.fn(),
}));

vi.mock("../app/review/reviewDataCache", () => ({
    getCachedReviewSearchPages:
        cacheMocks.getCachedReviewSearchPages,
    loadReviewSearchPages:
        cacheMocks.loadReviewSearchPages,
}));

const pages: ReviewPageData[] = [
    {
        pageNumber: 1,
        textItems: [],
        tables: [],
        images: [],
    },
];

beforeEach(() => {
    vi.resetAllMocks();

    cacheMocks.getCachedReviewSearchPages
        .mockReturnValue(undefined);

    cacheMocks.loadReviewSearchPages
        .mockResolvedValue(pages);
});

describe("Review Find workflows", () => {
    it("reuses cached search pages without fetching again", async () => {
        cacheMocks.getCachedReviewSearchPages
            .mockReturnValue(pages);

        const { result } = renderHook(() =>
            useReviewFindWorkflows("document-1"),
        );

        expect(result.current.searchPages).toBe(pages);

        await act(async () => {
            await result.current.openFindAndRedact();
        });

        expect(result.current.isFindAndRedactOpen)
            .toBe(true);

        expect(cacheMocks.loadReviewSearchPages)
            .not.toHaveBeenCalled();

        expect(cacheMocks.getCachedReviewSearchPages)
            .toHaveBeenCalledWith("document-1");
    });

    it("loads search data once and opens only one Find modal at a time", async () => {
        const { result } = renderHook(() =>
            useReviewFindWorkflows("document-1"),
        );

        await act(async () => {
            await result.current.openFindAndRedact();
        });

        expect(result.current.searchPages).toBe(pages);
        expect(result.current.isFindAndRedactOpen).toBe(true);
        expect(result.current.isFindAndPartiallyRedactOpen).toBe(false);
        expect(result.current.isFindAndDiscloseOpen).toBe(false);

        await act(async () => {
            await result.current.openFindAndPartiallyRedact();
        });

        expect(result.current.isFindAndRedactOpen).toBe(false);
        expect(result.current.isFindAndPartiallyRedactOpen).toBe(true);
        expect(result.current.isFindAndDiscloseOpen).toBe(false);

        await act(async () => {
            await result.current.openFindAndDisclose();
        });

        expect(result.current.isFindAndRedactOpen).toBe(false);
        expect(result.current.isFindAndPartiallyRedactOpen).toBe(false);
        expect(result.current.isFindAndDiscloseOpen).toBe(true);

        expect(cacheMocks.loadReviewSearchPages)
            .toHaveBeenCalledTimes(1);

        expect(cacheMocks.loadReviewSearchPages)
            .toHaveBeenCalledWith("document-1");
    });

    it("keeps the modal closed after a load failure and allows retrying", async () => {
        cacheMocks.loadReviewSearchPages
            .mockRejectedValueOnce(
                new Error("Unable to load search pages"),
            )
            .mockResolvedValueOnce(pages);

        const { result } = renderHook(() =>
            useReviewFindWorkflows("document-1"),
        );

        await act(async () => {
            await result.current.openFindAndDisclose();
        });

        expect(result.current.isFindAndDiscloseOpen)
            .toBe(false);

        expect(result.current.searchError)
            .toBe("Unable to load search pages");

        expect(result.current.isSearchLoading)
            .toBe(false);

        await act(async () => {
            await result.current.openFindAndDisclose();
        });

        expect(result.current.isFindAndDiscloseOpen)
            .toBe(true);

        expect(result.current.searchError).toBeNull();
        expect(result.current.searchPages).toBe(pages);

        expect(cacheMocks.loadReviewSearchPages)
            .toHaveBeenCalledTimes(2);
    });

    it("reports loading while a search request is pending", async () => {
        let resolveRequest:
            | ((value: ReviewPageData[]) => void)
            | undefined;

        const pending = new Promise<ReviewPageData[]>(
            (resolve) => {
                resolveRequest = resolve;
            },
        );

        cacheMocks.loadReviewSearchPages
            .mockReturnValue(pending);

        const { result } = renderHook(() =>
            useReviewFindWorkflows("document-1"),
        );

        let opening: Promise<void> | undefined;

        act(() => {
            opening = result.current.openFindAndRedact();
        });

        expect(result.current.isSearchLoading)
            .toBe(true);

        expect(result.current.isFindAndRedactOpen)
            .toBe(false);

        await act(async () => {
            resolveRequest?.(pages);
            await opening;
        });

        expect(result.current.isSearchLoading)
            .toBe(false);

        expect(result.current.isFindAndRedactOpen)
            .toBe(true);
    });

    it("does not request search data without a document ID", async () => {
        const { result } = renderHook(() =>
            useReviewFindWorkflows(null),
        );

        await act(async () => {
            await result.current.openFindAndRedact();
        });

        expect(result.current.isFindAndRedactOpen)
            .toBe(false);

        expect(result.current.searchPages).toBeNull();

        expect(cacheMocks.loadReviewSearchPages)
            .not.toHaveBeenCalled();

        expect(cacheMocks.getCachedReviewSearchPages)
            .not.toHaveBeenCalled();
    });
});
