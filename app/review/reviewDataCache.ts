import { fetchJson } from "../lib/api";
import type { ReviewResponse } from "./types";

const reviewDataCache = new Map<string, ReviewResponse>();
const reviewDataRequests = new Map<string, Promise<ReviewResponse>>();

export function getCachedReviewData(
    documentId: string
): ReviewResponse | undefined {
    return reviewDataCache.get(documentId);
}

export function loadReviewData(
    documentId: string
): Promise<ReviewResponse> {
    const cached = reviewDataCache.get(documentId);

    if (cached) {
        return Promise.resolve(cached);
    }

    const existingRequest = reviewDataRequests.get(documentId);

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
            reviewDataCache.set(documentId, result);
            return result;
        })
        .finally(() => {
            reviewDataRequests.delete(documentId);
        });

    reviewDataRequests.set(documentId, request);

    return request;
}

export function clearCachedReviewData(documentId: string) {
    reviewDataCache.delete(documentId);
    reviewDataRequests.delete(documentId);
}