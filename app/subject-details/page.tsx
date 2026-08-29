"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "../lib/api";
import ServiceErrorPage from "../components/ServiceErrorPage";
import { useWorkflowGuard } from "../lib/useWorkflowGuard";

type ProcessDocumentResponse = {
    documentId: string;
    status: string;
};

function SubjectDetailsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const documentId = searchParams.get("documentId");

    const {
        isChecking: isCheckingWorkflow,
        errorVariant: workflowErrorVariant,
    } = useWorkflowGuard("subject-details", documentId);

    const [subjectName, setSubjectName] = useState("");
    const [subjectPrisonNumber, setSubjectPrisonNumber] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAbandoning, setIsAbandoning] = useState(false);
    const otherPhrases = "";

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

    async function handleBackToUpload() {
        if (!documentId || isAbandoning) {
            return;
        }

        try {
            setIsAbandoning(true);
            setError(null);

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
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to return to upload. Try again."
            );
            setIsAbandoning(false);
        }
    }

    async function handleContinue() {
        if (!documentId) {
            setError("Missing document ID.");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            await fetchJson<ProcessDocumentResponse>(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/process`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        subjectName,
                        subjectPrisonNumber,
                        otherPhrases,
                    }),
                }
            );

            router.push(`/processing?documentId=${documentId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
            setIsSubmitting(false);
        }
    }

    return (
        <main className="govuk-main-wrapper" id="main-content">
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <button
                        type="button"
                        className="govuk-back-link govuk-back-link-button"
                        onClick={handleBackToUpload}
                        disabled={isAbandoning || isSubmitting}
                    >
                        {isAbandoning ? "Returning to upload..." : "Back"}
                    </button>

                    {error && (
                        <div
                            className="govuk-error-summary"
                            data-module="govuk-error-summary"
                            aria-labelledby="error-summary-title"
                            role="alert"
                            tabIndex={-1}
                        >
                            <h2 className="govuk-error-summary__title" id="error-summary-title">
                                There is a problem
                            </h2>

                            <div className="govuk-error-summary__body">
                                <ul className="govuk-list govuk-error-summary__list">
                                    <li>
                                        <a href="#subject-details-error">{error}</a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    <h1 className="govuk-heading-xl">Phrases to allow</h1>

                    <form
                        noValidate
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleContinue();
                        }}
                    >
                        {error && (
                            <p id="subject-details-error" className="govuk-error-message">
                                <span className="govuk-visually-hidden">Error:</span> {error}
                            </p>
                        )}

                        <div className="govuk-form-group">
                            <label className="govuk-label govuk-label--m" htmlFor="subject-name">
                                Subject name
                            </label>
                            <input
                                className="govuk-input"
                                id="subject-name"
                                name="subjectName"
                                type="text"
                                value={subjectName}
                                onChange={(e) => setSubjectName(e.target.value)}
                            />
                        </div>

                        <div className="govuk-form-group">
                            <label className="govuk-label govuk-label--m" htmlFor="subject-prison-number">
                                Subject prison number
                            </label>
                            <input
                                className="govuk-input"
                                id="subject-prison-number"
                                name="subjectPrisonNumber"
                                type="text"
                                value={subjectPrisonNumber}
                                onChange={(e) => setSubjectPrisonNumber(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            className="govuk-button"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Starting processing..." : "Continue"}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}

export default function SubjectDetailsPage() {
    return (
        <Suspense fallback={null}>
            <SubjectDetailsContent />
        </Suspense>
    );
}