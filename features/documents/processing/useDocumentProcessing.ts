
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchJson } from "../../../app/lib/api";
import {
    loadReviewData,
    loadReviewSearchPages,
} from "../../../app/review/reviewDataCache";
import {
    normaliseProcessingProgress,
} from "../../../app/components/ProcessingProgress";

type DocumentStatusResponse = {
    documentId: string;
    filename: string;
    status: string;
    processingProgress: number;
};

type DocumentProcessingResult = {
    processingProgress: number;
    error: string | null;
    isAbandoning: boolean;
    handleBackToUpload: () => Promise<void>;
};

const POLLING_INTERVAL_MS = 2000;

export function useDocumentProcessing(
    documentId: string | null,
    enabled: boolean,
): DocumentProcessingResult {
    const router = useRouter();

    const [
        processingProgress,
        setProcessingProgress,
    ] = useState(0);

    const [error, setError] =
        useState<string | null>(null);

    const [isAbandoning, setIsAbandoning] =
        useState(false);

    const isAbandoningRef = useRef(false);

    async function handleBackToUpload(): Promise<void> {
        if (!documentId || isAbandoningRef.current) {
            return;
        }

        isAbandoningRef.current = true;

        setIsAbandoning(true);
        setError(null);

        try {
            await fetchJson(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                    documentId,
                )}/abandon`,
                {
                    method: "POST",
                },
            );

            router.push("/upload");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to stop processing. Try again.",
            );

            isAbandoningRef.current = false;
            setIsAbandoning(false);
        }
    }

    useEffect(() => {
        if (!documentId || !enabled || isAbandoning) {
            return;
        }

        const currentDocumentId = documentId;

        let isActive = true;

        let timeoutId: ReturnType<
            typeof setTimeout
        > | null = null;

        let controller: AbortController | null = null;

        function scheduleNextPoll() {
            if (
                !isActive ||
                isAbandoningRef.current
            ) {
                return;
            }

            timeoutId = setTimeout(() => {
                void pollStatus();
            }, POLLING_INTERVAL_MS);
        }

        async function pollStatus() {
            if (
                !isActive ||
                isAbandoningRef.current
            ) {
                return;
            }

            controller = new AbortController();

            try {
                const data =
                    await fetchJson<DocumentStatusResponse>(
                        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                            currentDocumentId,
                        )}/status`,
                        {
                            cache: "no-store",
                            signal: controller.signal,
                        },
                    );

                if (
                    !isActive ||
                    isAbandoningRef.current
                ) {
                    return;
                }

                const nextProgress =
                    normaliseProcessingProgress(
                        data.processingProgress,
                    );

                setProcessingProgress(
                    (currentProgress) =>
                        Math.max(
                            currentProgress,
                            nextProgress,
                        ),
                );

                setError(null);

                if (
                    data.status ===
                    "ready_for_review"
                ) {
                    setProcessingProgress(100);

                    const [
                        reviewDataResult,
                        reviewSearchResult,
                    ] = await Promise.allSettled([
                        loadReviewData(
                            currentDocumentId,
                        ),
                        loadReviewSearchPages(
                            currentDocumentId,
                        ),
                    ]);

                    if (
                        reviewDataResult.status ===
                        "rejected"
                    ) {
                        console.warn(
                            "Review data prefetch failed",
                            reviewDataResult.reason,
                        );
                    }

                    if (
                        reviewSearchResult.status ===
                        "rejected"
                    ) {
                        console.warn(
                            "Review search data prefetch failed",
                            reviewSearchResult.reason,
                        );
                    }

                    if (
                        !isActive ||
                        isAbandoningRef.current
                    ) {
                        return;
                    }

                    router.replace(
                        `/review?documentId=${encodeURIComponent(
                            currentDocumentId,
                        )}`,
                    );

                    return;
                }

                if (data.status === "failed") {
                    setError(
                        "The document could not be processed.",
                    );
                    return;
                }

                scheduleNextPoll();
            } catch (err) {
                if (
                    !isActive ||
                    isAbandoningRef.current
                ) {
                    return;
                }

                if (
                    err instanceof DOMException &&
                    err.name === "AbortError"
                ) {
                    return;
                }

                console.error(
                    "Document status polling failed",
                    err,
                );

                setError(
                    "Unable to check the document status.",
                );
            }
        }

        void pollStatus();

        return () => {
            isActive = false;

            controller?.abort();

            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [
        documentId,
        enabled,
        isAbandoning,
        router,
    ]);

    return {
        processingProgress,
        error,
        isAbandoning,
        handleBackToUpload,
    };
}
