"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ScannedDocumentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const documentId = searchParams.get("documentId");
    const filename = searchParams.get("filename") || "Uploaded document";

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
                        aria-labelledby="scanned-document-heading"
                    >
                        <div className="moj-interruption-card__content">
                            <h1
                                className="moj-interruption-card__heading"
                                id="scanned-document-heading"
                            >
                                This might be a scanned document
                            </h1>

                            <div className="moj-interruption-card__body">
                                <p>
                                    The document contains lots of images and not much text.
                                </p>

                                <p>
                                    It might be a document that has been scanned with optical
                                    character recognition (OCR) applied, which can&apos;t be
                                    processed in Justice Redact yet.
                                </p>

                                <p>
                                    You can go back if you&apos;d like to upload a different file.
                                </p>
                            </div>

                            <div className="govuk-button-group moj-interruption-card__actions">
                                <button
                                    type="button"
                                    className="govuk-button govuk-button--inverse"
                                    data-module="govuk-button"
                                    onClick={() => router.push("/upload")}
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