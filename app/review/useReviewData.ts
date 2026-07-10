import { useEffect, useState } from "react";

import { ApiError, fetchJson } from "../lib/api";
import type { ReviewResponse } from "./types";

export function useReviewData(documentId: string | null) {
    const [data, setData] = useState<ReviewResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        const controller = new AbortController();

        async function loadReview() {
            if (!documentId) {
                setError("Missing document ID.");
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                setData(null);

                const result = await fetchJson<ReviewResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/review`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    }
                );

                if (!isActive) return;

                setData(result);
            } catch (err) {
                if (!isActive) return;

                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                if (err instanceof ApiError) {
                    setError(err.message);
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load review data."
                );
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        }

        void loadReview();

        return () => {
            isActive = false;
            controller.abort();
        };
    }, [documentId]);

    return {
        data,
        isLoading,
        error,
    };
}