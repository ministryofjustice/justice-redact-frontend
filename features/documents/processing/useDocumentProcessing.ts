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

type WorkflowNavigationResponse = {
    documentId: string;
    status: string;
    preferredPage: string;
};

type DocumentProcessingResult = {
    processingProgress: number;
    error: string | null;
    returnError: string | null;
    isReturning: boolean;
    handleBackToSubjectDetails: () => Promise<void>;
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

    const [returnError, setReturnError] =
        useState<string | null>(null);

    const [isReturning, setIsReturning] =
        useState(false);

    const isReturningRef = useRef(false);

    async function handleBackToSubjectDetails(): Promise<void> {
        if (!documentId || isReturningRef.current) {
            return;
        }

        isReturningRef.current = true;

        setIsReturning(true);
        setReturnError(null);

        try {
            const workflow =
                await fetchJson<WorkflowNavigationResponse>(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                    documentId,
                )}/return-to-subject-details`,
                {
                    method: "POST",
                },
            );

            const documentQuery =
                `documentId=${encodeURIComponent(documentId)}`;

            if (workflow.preferredPage === "subject-details") {
                router.replace(
                    `/subject-details?${documentQuery}`,
                );
                return;
            }

            if (workflow.preferredPage === "review") {
                router.replace(
                    `/review?${documentQuery}`,
                );
                return;
            }

            throw new Error(
                "Unable to return to the previous page.",
            );
        } catch (err) {
            setReturnError(
                err instanceof Error
                    ? err.message
                    : "Unable to return to subject details. Try again.",
            );

            isReturningRef.current = false;
            setIsReturning(false);
        }
    }

    useEffect(() => {
        if (!documentId || !enabled || isReturning) {
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
                isReturningRef.current
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
                isReturningRef.current
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
                    isReturningRef.current
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
                        isReturningRef.current
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
                    isReturningRef.current
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
        isReturning,
        router,
    ]);

    return {
        processingProgress,
        error,
        returnError,
        isReturning,
        handleBackToSubjectDetails,
    };
}
