"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "../../../app/lib/api";
import {
    consumeApplyRedactionsFailure,
} from "../../../app/lib/applyRedactionsFailure";
import {
    buildApplyRedactionsRequest,
} from "../../../app/review/applyRedactions";
import type {
    ManualDecision,
    PageStatus,
} from "../../../app/review/types";

type ApplyRedactionsResponse = {
    documentId: string;
    runId: string;
    status: string;
};

export type UseApplyRedactionsOptions = {
    documentId: string | null;
    documentData: { documentId: string } | null | undefined;
    manualSelections: ManualDecision[];
    pageStatuses: Record<number, PageStatus>;
    hasDecisionConflict: boolean;
    clearDecisionSaveError: () => void;
    saveBeforeApply: (
        selections: ManualDecision[],
        statuses: Record<number, PageStatus>,
    ) => Promise<number>;
};

export function useApplyRedactions({
    documentId,
    documentData,
    manualSelections,
    pageStatuses,
    hasDecisionConflict,
    clearDecisionSaveError,
    saveBeforeApply,
}: UseApplyRedactionsOptions) {
    const router = useRouter();

    // Synchronous protection against duplicate Apply requests.
    const applyInFlightRef = useRef(false);

    const [
        isApplyingRedactions,
        setIsApplyingRedactions,
    ] = useState(false);

    const [
        applyRedactionsError,
        setApplyRedactionsError,
    ] = useState<string | null>(null);

    const [
        showApplyRedactionsFailure,
        setShowApplyRedactionsFailure,
    ] = useState(() => {
        if (!documentId) {
            return false;
        }

        return consumeApplyRedactionsFailure(documentId);
    });

    useEffect(() => {
        if (!showApplyRedactionsFailure) {
            return;
        }

        window.scrollTo({
            top: 0,
            behavior: "auto",
        });
    }, [showApplyRedactionsFailure]);

    function showApplyFailureAlert() {
        setApplyRedactionsError(null);
        clearDecisionSaveError();
        setShowApplyRedactionsFailure(true);
        setIsApplyingRedactions(false);

        window.scrollTo({
            top: 0,
            behavior: "auto",
        });
    }

    async function handleApplyRedactions() {
        if (applyInFlightRef.current) {
            return;
        }

        if (!documentData || !documentId) {
            return;
        }

        const currentDocumentSelections =
            manualSelections.filter(
                (selection) =>
                    selection.documentId === documentId,
            );

        const hasPageDecisions =
            Object.keys(pageStatuses).length > 0;

        if (
            currentDocumentSelections.length === 0 &&
            !hasPageDecisions
        ) {
            return;
        }

        if (hasDecisionConflict) {
            setApplyRedactionsError(
                "Refresh the page to load the latest saved decisions before applying redactions.",
            );
            return;
        }

        applyInFlightRef.current = true;

        try {
            setIsApplyingRedactions(true);
            setApplyRedactionsError(null);
            setShowApplyRedactionsFailure(false);

            const savedRevision = await saveBeforeApply(
                currentDocumentSelections,
                pageStatuses,
            );

            const applyResponse =
                await fetchJson<ApplyRedactionsResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentData.documentId}/apply-redactions`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            ...buildApplyRedactionsRequest(
                                documentData.documentId,
                                currentDocumentSelections,
                                pageStatuses,
                            ),
                            expectedRevision: savedRevision,
                        }),
                    },
                );

            router.push(
                `/applying-redactions?documentId=${documentData.documentId}&runId=${applyResponse.runId}`,
            );
        } catch {
            // Unlock on failure so the user can retry.
            applyInFlightRef.current = false;
            showApplyFailureAlert();
        }
    }

    return {
        isApplyingRedactions,
        applyRedactionsError,
        showApplyRedactionsFailure,
        handleApplyRedactions,
    };
}
