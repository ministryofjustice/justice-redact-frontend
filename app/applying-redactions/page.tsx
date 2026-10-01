"use client";

import {
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ServiceErrorPage from "../components/ServiceErrorPage";
import { useWorkflowGuard } from "../lib/useWorkflowGuard";
import BackLink from "../components/BackLink";
import { ApiError, fetchJson } from "../lib/api";
import {
    setApplyRedactionsFailure,
} from "../lib/applyRedactionsFailure";
import ProcessingProgress, {
    normaliseProcessingProgress,
} from "../components/ProcessingProgress";

type RedactionRunStatusResponse = {
    documentId: string;
    runId: string;
    status: string;
    processingProgress: number;
};

function ApplyingRedactionsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const documentId = searchParams.get("documentId");
    const runId = searchParams.get("runId");

    const {
        isChecking: isCheckingWorkflow,
        errorVariant: workflowErrorVariant,
    } = useWorkflowGuard(
        "applying-redactions",
        documentId,
        runId,
    );

    const [processingProgress, setProcessingProgress] =
        useState(0);
    const [error, setError] = useState<string | null>(null);

    const [isCancelling, setIsCancelling] = useState(false);
    const cancellationRequestedRef = useRef(false);

    const returnToReviewWithApplyFailure = useCallback(() => {
        if (!documentId) {
            return;
        }

        setApplyRedactionsFailure(documentId);

        router.replace(
            `/review?documentId=${encodeURIComponent(documentId)}`,
        );
    }, [documentId, router]);

    async function handleBackToReview() {
        if (!documentId || !runId || isCancelling) {
            return;
        }

        cancellationRequestedRef.current = true;
        setIsCancelling(true);
        setError(null);

        try {
            await fetchJson(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                    documentId
                )}/redaction-runs/${encodeURIComponent(runId)}/cancel`,
                {
                    method: "POST",
                }
            );

            router.replace(
                `/review?documentId=${encodeURIComponent(documentId)}`
            );
        } catch (err) {
            cancellationRequestedRef.current = false;

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to return to review. Try again."
            );

            setIsCancelling(false);
        }
    }

    useEffect(() => {
        if (
            !documentId ||
            !runId ||
            isCheckingWorkflow ||
            workflowErrorVariant
        ) {
            return;
        }

        const currentDocumentId = documentId;
        const currentRunId = runId;

        let isActive = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let controller: AbortController | null = null;

        const scheduleNextPoll = () => {
            if (!isActive || cancellationRequestedRef.current) return;

            timeoutId = setTimeout(() => {
                void pollStatus();
            }, 2000);
        };

        async function pollStatus() {
            if (!isActive) return;

            controller = new AbortController();

            try {
                const data = await fetchJson<RedactionRunStatusResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                        currentDocumentId,
                    )}/redaction-runs/${encodeURIComponent(
                        currentRunId,
                    )}/status`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    },
                );

                if (!isActive) return;
                if (cancellationRequestedRef.current) return;

                const nextProgress = normaliseProcessingProgress(
                    data.processingProgress,
                );

                setProcessingProgress((currentProgress) =>
                    Math.max(
                        currentProgress,
                        nextProgress,
                    ),
                );

                setError(null);

                if (data.status === "completed") {
                    setProcessingProgress(100);

                    router.push(
                        `/export?documentId=${encodeURIComponent(
                            currentDocumentId,
                        )}&runId=${encodeURIComponent(
                            currentRunId,
                        )}`,
                    );

                    return;
                }

                if (data.status === "failed") {
                    returnToReviewWithApplyFailure();
                    return;
                }

                if (data.status === "cancelled") {
                    router.replace(
                        `/review?documentId=${encodeURIComponent(
                            currentDocumentId,
                        )}`,
                    );
                    return;
                }

                scheduleNextPoll();
            } catch (err) {
                if (!isActive) return;

                if (
                    err instanceof DOMException &&
                    err.name === "AbortError"
                ) {
                    return;
                }

                if (
                    err instanceof ApiError &&
                    err.status === 401
                ) {
                    return;
                }

                console.error(
                    "Redaction status polling failed",
                    err,
                );

                try {
                    await fetchJson(
                        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                            currentDocumentId,
                        )}/redaction-runs/${encodeURIComponent(
                            currentRunId,
                        )}/cancel`,
                        {
                            method: "POST",
                        },
                    );

                    if (!isActive) return;

                    returnToReviewWithApplyFailure();
                } catch (cancelError) {
                    if (!isActive) return;

                    if (
                        cancelError instanceof ApiError &&
                        cancelError.status === 401
                    ) {
                        return;
                    }

                    try {
                        const workflow = await fetchJson<{
                            documentId: string;
                            status: string;
                            preferredPage: string;
                            currentRedactionRunId: string | null;
                            allowedPages: string[];
                        }>(
                            `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                                currentDocumentId,
                            )}/workflow`,
                            {
                                cache: "no-store",
                            },
                        );

                        if (!isActive) return;

                        if (workflow.status === "redaction_complete") {
                            router.replace(
                                `/export?documentId=${encodeURIComponent(
                                    currentDocumentId,
                                )}&runId=${encodeURIComponent(
                                    currentRunId,
                                )}`,
                            );
                            return;
                        }

                        if (
                            workflow.status === "redaction_failed" ||
                            workflow.status === "ready_for_review"
                        ) {
                            setApplyRedactionsFailure(
                                currentDocumentId,
                            );

                            router.replace(
                                `/review?documentId=${encodeURIComponent(
                                    currentDocumentId,
                                )}`,
                            );

                            return;
                        }

                        scheduleNextPoll();
                    } catch (workflowError) {
                        if (!isActive) return;

                        if (
                            workflowError instanceof ApiError &&
                            workflowError.status === 401
                        ) {
                            return;
                        }

                        scheduleNextPoll();
                    }
                }
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
        runId,
        isCheckingWorkflow,
        workflowErrorVariant,
        router,
        returnToReviewWithApplyFailure,
    ]);

    if (isCheckingWorkflow) {
        return null;
    }

    if (workflowErrorVariant) {
        return (
            <ServiceErrorPage
                variant={workflowErrorVariant}
                documentId={documentId}
            />
        );
    }

    if (
        !documentId ||
        !runId ||
        error
    ) {
        return (
            <ServiceErrorPage
                variant={500}
                documentId={documentId}
            />
        );
    }

    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                <section aria-labelledby="applying-redactions-heading">
                    <BackLink
                        href={
                            documentId
                                ? `/review?documentId=${encodeURIComponent(
                                    documentId,
                                )}`
                                : "/upload"
                        }
                        onBack={handleBackToReview}
                        disabled={isCancelling}
                    >
                        {isCancelling
                            ? "Returning to review..."
                            : "Back"}
                    </BackLink>

                    <h1
                        className="govuk-heading-xl"
                        id="applying-redactions-heading"
                    >
                        Your redactions are being applied
                    </h1>

                    <ProcessingProgress
                        progress={processingProgress}
                        ariaLabel="Applying redactions progress"
                    />
                </section>
            </div>
        </div>
    );
}

export default function ApplyingRedactionsPage() {
    return (
        <Suspense fallback={null}>
            <ApplyingRedactionsContent />
        </Suspense>
    );
}