"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

    const documentId = searchParams.get("documentId");
    const filename = searchParams.get("filename") || "Uploaded document";
    const reason = searchParams.get("reason");

    const warningContent = getWarningContent(reason);

    function handleUploadDifferentFile() {
        router.push("/upload");
    }

    function handleContinueAnyway() {
        if (!documentId) {
            router.push("/upload");
            return;
        }

        router.push(
            `/subject-details?documentId=${encodeURIComponent(
                documentId
            )}&filename=${encodeURIComponent(filename)}`
        );
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

                            <div className="govuk-button-group moj-interruption-card__actions">
                                <button
                                    type="button"
                                    className="govuk-button govuk-button--inverse"
                                    data-module="govuk-button"
                                    onClick={handleUploadDifferentFile}
                                >
                                    Upload a different file
                                </button>

                                <button
                                    type="button"
                                    className="govuk-link govuk-link--inverse button-as-link"
                                    onClick={handleContinueAnyway}
                                >
                                    Continue anyway
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