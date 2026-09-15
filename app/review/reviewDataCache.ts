import { fetchJson } from "../lib/api";
import type {
    ReviewPageData,
    ReviewResponse,
} from "./types";

type ReviewPagesResponse = {
    pageStart: number;
    pageEnd: number;
    pages: ReviewPageData[];
};

type ReviewSearchResponse = {
    pages: ReviewPageData[];
};

const reviewDataCache =
    new Map<string, ReviewResponse>();

const reviewDataRequests =
    new Map<string, Promise<ReviewResponse>>();

const reviewPagesCache =
    new Map<string, ReviewPageData[]>();

const reviewPagesRequests =
    new Map<string, Promise<ReviewPageData[]>>();

const MAX_CACHED_REVIEW_PAGE_BATCHES = 3;

const reviewSearchCache =
    new Map<string, ReviewPageData[]>();

const reviewSearchRequests =
    new Map<string, Promise<ReviewPageData[]>>();

const MAX_CACHED_REVIEW_SEARCH_DOCUMENTS = 1;


function cacheReviewSearchPages(
    documentId: string,
    pages: ReviewPageData[]
) {
    reviewSearchCache.delete(
        documentId
    );

    reviewSearchCache.set(
        documentId,
        pages
    );

    while (
        reviewSearchCache.size >
        MAX_CACHED_REVIEW_SEARCH_DOCUMENTS
    ) {
        const oldestDocumentId =
            reviewSearchCache.keys().next().value;

        if (
            typeof oldestDocumentId !== "string"
        ) {
            break;
        }

        reviewSearchCache.delete(
            oldestDocumentId
        );
    }
}


function reviewPagesCacheKey(
    documentId: string,
    pageStart: number,
    pageEnd: number
) {
    return `${documentId}:${pageStart}:${pageEnd}`;
}


function getCachedPageBatch(
    cacheKey: string
): ReviewPageData[] | undefined {
    const cached =
        reviewPagesCache.get(cacheKey);

    if (!cached) {
        return undefined;
    }

    // Refresh insertion order so this entry becomes
    // the most recently used batch.
    reviewPagesCache.delete(cacheKey);
    reviewPagesCache.set(
        cacheKey,
        cached
    );

    return cached;
}


function cachePageBatch(
    cacheKey: string,
    pages: ReviewPageData[]
) {
    reviewPagesCache.delete(cacheKey);

    reviewPagesCache.set(
        cacheKey,
        pages
    );

    while (
        reviewPagesCache.size >
        MAX_CACHED_REVIEW_PAGE_BATCHES
    ) {
        const oldestKey =
            reviewPagesCache.keys().next().value;

        if (
            typeof oldestKey !== "string"
        ) {
            break;
        }

        reviewPagesCache.delete(
            oldestKey
        );
    }
}


export function getCachedReviewData(
    documentId: string
): ReviewResponse | undefined {
    return reviewDataCache.get(documentId);
}


export function loadReviewData(
    documentId: string
): Promise<ReviewResponse> {
    const cached =
        reviewDataCache.get(documentId);

    if (cached) {
        return Promise.resolve(cached);
    }

    const existingRequest =
        reviewDataRequests.get(documentId);

    if (existingRequest) {
        return existingRequest;
    }

    const request = fetchJson<ReviewResponse>(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/review`,
        {
            cache: "no-store",
        }
    )
        .then((result) => {
            reviewDataCache.set(
                documentId,
                result
            );

            return result;
        })
        .finally(() => {
            reviewDataRequests.delete(
                documentId
            );
        });

    reviewDataRequests.set(
        documentId,
        request
    );

    return request;
}


export function getCachedReviewPages(
    documentId: string,
    pageStart: number,
    pageEnd: number
): ReviewPageData[] | undefined {
    return getCachedPageBatch(
        reviewPagesCacheKey(
            documentId,
            pageStart,
            pageEnd
        )
    );
}


export function loadReviewPages(
    documentId: string,
    pageStart: number,
    pageEnd: number
): Promise<ReviewPageData[]> {
    const cacheKey =
        reviewPagesCacheKey(
            documentId,
            pageStart,
            pageEnd
        );

    const cached =
        getCachedPageBatch(cacheKey);

    if (cached) {
        return Promise.resolve(cached);
    }

    const existingRequest =
        reviewPagesRequests.get(cacheKey);

    if (existingRequest) {
        return existingRequest;
    }

    const query = new URLSearchParams({
        pageStart: String(pageStart),
        pageEnd: String(pageEnd),
    });

    const request =
        fetchJson<ReviewPagesResponse>(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/review/pages?${query.toString()}`,
            {
                cache: "no-store",
            }
        )
            .then((result) => {
                cachePageBatch(
                    cacheKey,
                    result.pages
                );

                return result.pages;
            })
            .finally(() => {
                reviewPagesRequests.delete(
                    cacheKey
                );
            });

    reviewPagesRequests.set(
        cacheKey,
        request
    );

    return request;
}


export function getCachedReviewSearchPages(
    documentId: string
): ReviewPageData[] | undefined {
    return reviewSearchCache.get(
        documentId
    );
}


export function loadReviewSearchPages(
    documentId: string
): Promise<ReviewPageData[]> {
    const cached =
        reviewSearchCache.get(documentId);

    if (cached) {
        reviewSearchCache.delete(
            documentId
        );

        reviewSearchCache.set(
            documentId,
            cached
        );

        return Promise.resolve(cached);
    }

    const existingRequest =
        reviewSearchRequests.get(documentId);

    if (existingRequest) {
        return existingRequest;
    }

    const request =
        fetchJson<ReviewSearchResponse>(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/review/search`,
            {
                cache: "no-store",
            }
        )
            .then((result) => {
                cacheReviewSearchPages(
                    documentId,
                    result.pages
                );

                return result.pages;
            })
            .finally(() => {
                reviewSearchRequests.delete(
                    documentId
                );
            });

    reviewSearchRequests.set(
        documentId,
        request
    );

    return request;
}


export function clearCachedReviewData(
    documentId: string
) {
    reviewDataCache.delete(documentId);
    reviewDataRequests.delete(documentId);

    reviewSearchCache.delete(documentId);
    reviewSearchRequests.delete(documentId);

    const pageCachePrefix =
        `${documentId}:`;

    for (
        const key
        of reviewPagesCache.keys()
    ) {
        if (
            key.startsWith(
                pageCachePrefix
            )
        ) {
            reviewPagesCache.delete(key);
        }
    }

    for (
        const key
        of reviewPagesRequests.keys()
    ) {
        if (
            key.startsWith(
                pageCachePrefix
            )
        ) {
            reviewPagesRequests.delete(key);
        }
    }
}