"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "../lib/api";
import ServiceErrorPage from "../components/ServiceErrorPage";
import { useWorkflowGuard } from "../lib/useWorkflowGuard";
import type { WorkflowResponse } from "../lib/workflowNavigation";

function DocumentWarningContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isContinuing, setIsContinuing] = useState(false);
    const [isAbandoning, setIsAbandoning] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const documentId = searchParams.get("documentId");
    const filename = searchParams.get("filename") || "Uploaded document";

    const {
        isChecking: isCheckingWorkflow,
        errorVariant: workflowErrorVariant,
    } = useWorkflowGuard("document-warning", documentId);

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

    async function handleUploadDifferentFile() {
        if (!documentId || isAbandoning) {
            return;
        }

        setIsAbandoning(true);
        setErrorMessage(null);

        try {
            await fetchJson(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                    documentId
                )}/abandon`,
                {
                    method: "POST",
                }
            );

            router.push("/upload");
        } catch (err) {
            setErrorMessage(
                err instanceof Error
                    ? err.message
                    : "Unable to return to upload. Try again."
            );
            setIsAbandoning(false);
        }
    }

    async function handleContinueAnyway() {
        if (!documentId) {
            router.push("/upload");
            return;
        }

        setIsContinuing(true);
        setErrorMessage(null);

        try {
            await fetchJson<WorkflowResponse>(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                    documentId
                )}/warning/acknowledge`,
                {
                    method: "POST",
                }
            );

            router.push(
                `/subject-details?documentId=${encodeURIComponent(
                    documentId
                )}&filename=${encodeURIComponent(filename)}`
            );
        } catch {
            setErrorMessage(
                "We could not continue. Try again."
            );
            setIsContinuing(false);
        }
    }

    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-full">
                <section
                    className="moj-interruption-card"
                    aria-labelledby="document-warning-heading"
                >
                    <div className="moj-interruption-card__content">
                        <h1
                            className="moj-interruption-card__heading"
                            id="document-warning-heading"
                        >
                            This document cannot be processed
                        </h1>

                        <div className="moj-interruption-card__body">
                            <p>
                                Justice Redact cannot process:
                            </p>

                            <ul className="govuk-list govuk-list--bullet">
                                <li>
                                    Documents that have been scanned and have had
                                    optical character recognition (OCR) run on them
                                </li>
                                <li>
                                    Documents that are not from DPS or NOMIS
                                </li>
                            </ul>
                        </div>

                        {errorMessage && (
                            <p
                                className="govuk-error-message"
                                role="alert"
                            >
                                <span className="govuk-visually-hidden">
                                    Error:
                                </span>
                                {errorMessage}
                            </p>
                        )}

                        <div className="govuk-button-group moj-interruption-card__actions">
                            <button
                                type="button"
                                className="govuk-button govuk-button--inverse"
                                data-module="govuk-button"
                                onClick={handleUploadDifferentFile}
                                disabled={isAbandoning || isContinuing}
                            >
                                {isAbandoning ? "Returning to upload..." : "Upload a different file"}
                            </button>

                            <button
                                type="button"
                                className="govuk-link govuk-link--inverse button-as-link"
                                onClick={handleContinueAnyway}
                                disabled={isContinuing || isAbandoning}
                            >
                                {isContinuing ? "Continuing..." : "Continue anyway"}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default function DocumentWarningPage() {
    return (
        <Suspense fallback={null}>
            <DocumentWarningContent />
        </Suspense>
    );
}