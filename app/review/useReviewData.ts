import { useEffect, useState } from "react";

import type { ReviewResponse } from "./types";

export function useReviewData(documentId: string | null) {
    const [data, setData] = useState<ReviewResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
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

                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/review`
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.detail || "Failed to load review data.");
                }

                setData(result);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to load review data."
                );
            } finally {
                setIsLoading(false);
            }
        }

        loadReview();
    }, [documentId]);

    return {
        data,
        isLoading,
        error,
    };
}