"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import type {
    Dispatch,
    SetStateAction,
} from "react";

import {
    ApiError,
    fetchJson,
} from "../../../app/lib/api";

import {
    buildApplyRedactionsRequest,
} from "../../../app/review/applyRedactions";

import {
    buildReviewStateFromPersistedDecisions,
} from "../../../app/review/redactionDecisionPersistence";

import type {
    ManualDecision,
    PageStatus,
    RedactionDecisionSet,
} from "../../../app/review/types";

type SaveRedactionDecisionsResponse = {
    documentId: string;
    status: string;
    revision: number;
};

type ReviewDecisionPersistenceResult = {
    manualSelections: ManualDecision[];
    setManualSelections: Dispatch<
        SetStateAction<ManualDecision[]>
    >;

    pageStatuses: Record<number, PageStatus>;
    setPageStatuses: Dispatch<
        SetStateAction<Record<number, PageStatus>>
    >;

    hasLoadedPersistedDecisions: boolean;
    decisionLoadError: boolean;

    decisionSaveError: string | null;
    hasDecisionConflict: boolean;

    clearDecisionSaveError: () => void;

    saveBeforeApply: (
        selections: ManualDecision[],
        statuses: Record<number, PageStatus>,
    ) => Promise<number>;
};

const AUTOSAVE_DELAY_MS = 500;

export function useReviewDecisionPersistence(
    documentId: string | null,
    hasReviewData: boolean,
): ReviewDecisionPersistenceResult {
    const [
        manualSelections,
        setManualSelections,
    ] = useState<ManualDecision[]>([]);

    const [
        pageStatuses,
        setPageStatuses,
    ] = useState<Record<number, PageStatus>>({});

    const [
        hasLoadedPersistedDecisions,
        setHasLoadedPersistedDecisions,
    ] = useState(false);

    const [decisionLoadError, setDecisionLoadError] = useState(false);

    const [
        decisionSaveError,
        setDecisionSaveError,
    ] = useState<string | null>(null);

    const [
        hasDecisionConflict,
        setHasDecisionConflict,
    ] = useState(false);

    const decisionRevisionRef = useRef(0);

    const [
        lastSavedDecisionState,
        setLastSavedDecisionState,
    ] = useState<string | null>(null);

    const autosaveTimeoutRef = useRef<
        ReturnType<typeof setTimeout> | null
    >(null);

    const activeDecisionSaveRef = useRef<
        Promise<SaveRedactionDecisionsResponse> | null
    >(null);

    useEffect(() => {
        if (!documentId || !hasReviewData) {
            return;
        }

        const currentDocumentId = documentId;
        let isActive = true;

        async function loadPersistedDecisions() {
            try {
                const persisted =
                    await fetchJson<RedactionDecisionSet>(
                        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${currentDocumentId}/redaction-decisions`,
                    );

                if (!isActive) {
                    return;
                }

                const restored =
                    buildReviewStateFromPersistedDecisions(
                        currentDocumentId,
                        persisted.decisions,
                    );

                const restoredRequest =
                    buildApplyRedactionsRequest(
                        currentDocumentId,
                        restored.manualSelections,
                        restored.pageStatuses,
                    );

                setLastSavedDecisionState(
                    JSON.stringify(restoredRequest),
                );

                setManualSelections(
                    restored.manualSelections,
                );

                setPageStatuses(
                    restored.pageStatuses,
                );

                decisionRevisionRef.current =
                    persisted.revision;

                setDecisionLoadError(false);
                setHasLoadedPersistedDecisions(true);
            } catch (error) {
                if (!isActive) {
                    return;
                }

                console.error(
                    "Failed to load persisted redaction decisions",
                    error,
                );

                setDecisionLoadError(true);
            }
        }

        void loadPersistedDecisions();

        return () => {
            isActive = false;
        };
    }, [documentId, hasReviewData]);

    const saveCurrentDecisions = useCallback(
        async (
            selections: ManualDecision[],
            statuses: Record<number, PageStatus>,
        ): Promise<SaveRedactionDecisionsResponse> => {
            if (!documentId) {
                throw new Error("Missing document ID.");
            }

            const request =
                buildApplyRedactionsRequest(
                    documentId,
                    selections,
                    statuses,
                );

            try {
                const response =
                    await fetchJson<SaveRedactionDecisionsResponse>(
                        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/redaction-decisions`,
                        {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                ...request,
                                expectedRevision:
                                    decisionRevisionRef.current,
                            }),
                        },
                    );

                decisionRevisionRef.current =
                    response.revision;

                setLastSavedDecisionState(
                    JSON.stringify(request),
                );

                setDecisionSaveError(null);

                return response;
            } catch (error) {
                if (
                    error instanceof ApiError &&
                    error.status === 409
                ) {
                    setHasDecisionConflict(true);

                    setDecisionSaveError(
                        "This document has been changed in another tab. Refresh the page to load the latest saved decisions.",
                    );

                    throw error;
                }

                console.error(
                    "Failed to save redaction decisions",
                    error,
                );

                setDecisionSaveError(null);

                throw error;
            }
        },
        [documentId],
    );

    useEffect(() => {
        if (
            !documentId ||
            !hasLoadedPersistedDecisions ||
            hasDecisionConflict
        ) {
            return;
        }

        const currentRequest =
            buildApplyRedactionsRequest(
                documentId,
                manualSelections,
                pageStatuses,
            );

        const currentDecisionState =
            JSON.stringify(currentRequest);

        if (
            currentDecisionState ===
            lastSavedDecisionState
        ) {
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(
                autosaveTimeoutRef.current,
            );
        }

        autosaveTimeoutRef.current = setTimeout(
            () => {
                const previousSave =
                    activeDecisionSaveRef.current;

                const savePromise = (async () => {
                    if (previousSave) {
                        try {
                            await previousSave;
                        } catch (error) {
                            if (
                                error instanceof ApiError &&
                                error.status === 409
                            ) {
                                throw error;
                            }
                        }
                    }

                    return saveCurrentDecisions(
                        manualSelections,
                        pageStatuses,
                    );
                })();

                activeDecisionSaveRef.current =
                    savePromise;

                void savePromise
                    .catch(() => { })
                    .finally(() => {
                        if (
                            activeDecisionSaveRef.current ===
                            savePromise
                        ) {
                            activeDecisionSaveRef.current =
                                null;
                        }
                    });
            },
            AUTOSAVE_DELAY_MS,
        );

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(
                    autosaveTimeoutRef.current,
                );
            }
        };
    }, [
        documentId,
        manualSelections,
        pageStatuses,
        hasLoadedPersistedDecisions,
        hasDecisionConflict,
        lastSavedDecisionState,
        saveCurrentDecisions,
    ]);

    const saveBeforeApply = useCallback(
        async (
            selections: ManualDecision[],
            statuses: Record<number, PageStatus>,
        ): Promise<number> => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(
                    autosaveTimeoutRef.current,
                );

                autosaveTimeoutRef.current = null;
            }

            if (activeDecisionSaveRef.current) {
                try {
                    await activeDecisionSaveRef.current;
                } catch (error) {
                    if (
                        error instanceof ApiError &&
                        error.status === 409
                    ) {
                        throw error;
                    }
                }
            }

            const response =
                await saveCurrentDecisions(
                    selections,
                    statuses,
                );

            return response.revision;
        },
        [saveCurrentDecisions],
    );

    const clearDecisionSaveError =
        useCallback(() => {
            setDecisionSaveError(null);
        }, []);

    return {
        manualSelections,
        setManualSelections,

        pageStatuses,
        setPageStatuses,

        hasLoadedPersistedDecisions,
        decisionLoadError,

        decisionSaveError,
        hasDecisionConflict,

        clearDecisionSaveError,
        saveBeforeApply,
    };
}
