"use client";

import { useRouter } from "next/navigation";

export default function ScannedDocumentPage() {
    const router = useRouter();

    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-full">
                <div className="moj-interruption-card">
                    <div className="moj-interruption-card__content">
                        <h1 className="moj-interruption-card__heading">
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
                                onClick={() => router.push("/subject-details")}
                            >
                                Continue anyway
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}