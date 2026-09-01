"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, fetchJson } from "./api";
import {
    buildWorkflowUrl,
    isWorkflowPageAllowed,
    type WorkflowPage,
    type WorkflowResponse,
} from "./workflowNavigation";
import type { ServiceErrorVariant } from "../components/ServiceErrorPage";

type WorkflowGuardResult = {
    isChecking: boolean;
    workflow: WorkflowResponse | null;
    errorVariant: ServiceErrorVariant | null;
    isStaleRevision: boolean;
};

function getErrorVariant(error: unknown): ServiceErrorVariant {
    if (!(error instanceof ApiError)) {
        return 500;
    }

    if (error.status === 400) {
        return 400;
    }

    if (error.status === 403) {
        return 403;
    }

    if (error.status === 404) {
        return 404;
    }

    if (
        error.status === null ||
        error.status === 408 ||
        error.status === 429 ||
        error.status === 502 ||
        error.status === 503 ||
        error.status === 504
    ) {
        return 503;
    }

    return 500;
}

export function useWorkflowGuard(
    currentPage: WorkflowPage,
    documentId: string | null,
    routeRedactionRunId?: string | null,
): WorkflowGuardResult {
    const router = useRouter();

    const [isChecking, setIsChecking] = useState(true);
    const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
    const [errorVariant, setErrorVariant] =
        useState<ServiceErrorVariant | null>(null);
    const [isStaleRevision, setIsStaleRevision] = useState(false);

    useEffect(() => {
        if (!documentId) {
            router.replace("/upload");
            return;
        }

        const guardedDocumentId = documentId;

        const controller = new AbortController();
        let isActive = true;

        async function checkWorkflow(showCheckingState = true) {
            try {
                if (showCheckingState) {
                    setIsChecking(true);
                }
                setErrorVariant(null);
                setIsStaleRevision(false);

                const result = await fetchJson<WorkflowResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                        guardedDocumentId,
                    )}/workflow`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    },
                );

                if (!isActive) {
                    return;
                }

                setWorkflow(result);

                if (currentPage === "export") {
                    if (
                        routeRedactionRunId &&
                        routeRedactionRunId !== result.currentRedactionRunId
                    ) {
                        setIsStaleRevision(true);
                        setIsChecking(false);
                        return;
                    }

                    if (
                        !routeRedactionRunId &&
                        result.currentRedactionRunId &&
                        result.allowedPages.includes("export")
                    ) {
                        router.replace(
                            buildWorkflowUrl(
                                "export",
                                result.documentId,
                                result.currentRedactionRunId,
                            ),
                        );
                        return;
                    }
                }

                if (!isWorkflowPageAllowed(currentPage, result.allowedPages)) {
                    router.replace(
                        buildWorkflowUrl(
                            result.preferredPage,
                            result.documentId,
                            result.currentRedactionRunId,
                        ),
                    );
                    return;
                }

                if (
                    currentPage === "applying-redactions" &&
                    routeRedactionRunId !== result.currentRedactionRunId
                ) {
                    router.replace(
                        buildWorkflowUrl(
                            "applying-redactions",
                            result.documentId,
                            result.currentRedactionRunId,
                        ),
                    );
                    return;
                }

                setIsChecking(false);
            } catch (error) {
                if (!isActive) {
                    return;
                }

                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }

                setWorkflow(null);
                setErrorVariant(getErrorVariant(error));
                setIsChecking(false);
            }
        }

        void checkWorkflow();

        function handleVisibilityChange() {
            if (
                currentPage === "export" &&
                document.visibilityState === "visible"
            ) {
                void checkWorkflow(false);
            }
        }

        if (currentPage === "export") {
            document.addEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        }

        return () => {
            isActive = false;
            controller.abort();

            if (currentPage === "export") {
                document.removeEventListener(
                    "visibilitychange",
                    handleVisibilityChange,
                );
            }
        };

    }, [
        currentPage,
        documentId,
        routeRedactionRunId,
        router,
    ]);

    return {
        isChecking,
        workflow,
        errorVariant,
        isStaleRevision,
    };
}