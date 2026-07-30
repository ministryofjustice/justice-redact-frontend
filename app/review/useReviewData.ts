import { useEffect, useState } from "react";

import type { ReviewResponse } from "./types";
import {
    getCachedReviewData,
    loadReviewData,
} from "./reviewDataCache";

export function useReviewData(documentId: string | null) {
    const [data, setData] = useState<ReviewResponse | null>(() =>
        documentId ? getCachedReviewData(documentId) ?? null : null
    );
    const [isLoading, setIsLoading] = useState(
        () => !documentId || !getCachedReviewData(documentId)
    );
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        async function loadReview() {
            if (!documentId) {
                setError("Missing document ID.");
                setIsLoading(false);
                return;
            }

            const cached = getCachedReviewData(documentId);

            if (cached) {
                setData(cached);
                setError(null);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                setData(null);

                const result = await loadReviewData(documentId);

                if (!isActive) return;

                setData(result);
            } catch (err) {
                if (!isActive) return;

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
        };
    }, [documentId]);

    return {
        data,
        isLoading,
        error,
    };
}