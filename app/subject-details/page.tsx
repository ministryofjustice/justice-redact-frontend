"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "../lib/api";
import Link from "next/link";

type ProcessDocumentResponse = {
    documentId: string;
    status: string;
};

function SubjectDetailsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const documentId = searchParams.get("documentId");

    const [subjectName, setSubjectName] = useState("");
    const [subjectPrisonNumber, setSubjectPrisonNumber] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const otherPhrases = "";

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
                    <Link href="/upload" className="govuk-back-link">
                        Back
                    </Link>

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
        <Suspense
            fallback={
                <main className="govuk-main-wrapper" id="main-content">
                    <div className="hods-loading-spinner" role="status" aria-live="polite">
                        <span className="govuk-visually-hidden">Loading subject details</span>
                        <div className="hods-loading-spinner__spinner" aria-hidden="true"></div>
                    </div>
                </main>
            }
        >
            <SubjectDetailsContent />
        </Suspense>
    );
}