"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "../lib/api";
import type { WorkflowResponse } from "../lib/workflowNavigation";

type WarningReason = "scanned" | "unsupported-document-type";

type WarningContent = {
    heading: string;
    body: string[];
};

const WARNING_CONTENT: Record<WarningReason, WarningContent> = {
    scanned: {
        heading: "This might be a scanned document",
        body: [
            "The document contains lots of images and not much text.",
            "It might be a document that has been scanned with optical character recognition (OCR) applied, which cannot be processed in Justice Redact yet.",
            "You can go back if you would like to upload a different file.",
        ],
    },
    "unsupported-document-type": {
        heading: "This document does not seem to be a NOMIS or DPS document",
        body: [
            "Justice Redact only supports NOMIS and DPS documents at the moment.",
            "This document may not process correctly if it is from another source.",
            "You can go back if you would like to upload a different file.",
        ],
    },
};

function getWarningContent(reason: string | null): WarningContent {
    if (reason === "unsupported-document-type") {
        return WARNING_CONTENT["unsupported-document-type"];
    }

    return WARNING_CONTENT.scanned;
}

function DocumentWarningContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isContinuing, setIsContinuing] = useState(false);
    const [isAbandoning, setIsAbandoning] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const documentId = searchParams.get("documentId");
    const filename = searchParams.get("filename") || "Uploaded document";
    const reason = searchParams.get("reason");

    const warningContent = getWarningContent(reason);

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
        <main className="govuk-main-wrapper" id="main-content">
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
                                {warningContent.heading}
                            </h1>

                            <div className="moj-interruption-card__body">
                                {warningContent.body.map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
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
        </main>
    );
}

export default function DocumentWarningPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DocumentWarningContent />
        </Suspense>
    );
}