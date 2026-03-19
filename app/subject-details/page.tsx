"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SubjectDetailsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const documentId = searchParams.get("documentId");
    const filename = searchParams.get("filename") || "Uploaded document";

    const [subjectName, setSubjectName] = useState("");
    const [subjectPrisonNumber, setSubjectPrisonNumber] = useState("");
    const [otherPhrases, setOtherPhrases] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleContinue() {
        if (!documentId) {
            setError("Missing document ID.");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            const response = await fetch(
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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Failed to start processing.");
            }

            router.push(`/processing?documentId=${documentId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-full">
                    <div className="moj-alert moj-alert--success subject-details-alert" role="alert" aria-label="Success">
                        <div className="moj-alert__content">
                            <h2 className="moj-alert__heading">Upload successful</h2>
                            <p className="govuk-body">
                                <span className="subject-details__filename">{filename}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <Link href="/upload" className="govuk-back-link">
                        Back
                    </Link>

                    <h1 className="govuk-heading-xl">Phrases to allow</h1>

                    {error && (
                        <p className="govuk-error-message">
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

                    {/* <div className="govuk-form-group">
                        <label className="govuk-label govuk-label--m" htmlFor="other-phrases">
                            Any other phrases
                        </label>
                        <div id="other-phrases-hint" className="govuk-hint">
                            If you know any other details like the subject&apos;s NHS number, credit card
                            number, or other sensitive information, you can add them here. Separate phrases
                            or words with commas.
                        </div>
                        <textarea
                            className="govuk-textarea"
                            id="other-phrases"
                            name="otherPhrases"
                            rows={5}
                            aria-describedby="other-phrases-hint"
                            value={otherPhrases}
                            onChange={(e) => setOtherPhrases(e.target.value)}
                        />
                    </div> */}

                    <button
                        type="button"
                        className="govuk-button"
                        onClick={handleContinue}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Starting processing..." : "Continue"}
                    </button>
                </div>
            </div>
        </>
    );
}