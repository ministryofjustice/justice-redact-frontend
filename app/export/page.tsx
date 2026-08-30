"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, fetchJson } from "../lib/api";
import ServiceErrorPage from "../components/ServiceErrorPage";
import { useWorkflowGuard } from "../lib/useWorkflowGuard";

type PageCounts = {
    original: number;
    exempt: number;
    deleted: number;
    redacted: number;
};

type ExportResponse = {
    documentId: string;
    runId: string;
    filename: string;
    status: string;
    redactedExportUrl?: string;
    vettedExportUrl?: string;
    exemptExportUrl?: string | null;
    pageCount?: number;
    pageCounts?: PageCounts;
};

function buildDownloadUrl(path?: string | null) {
    if (!path) return null;
    return `${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`;
}

function getPageCounts(data: ExportResponse): PageCounts {
    if (data.pageCounts) {
        return data.pageCounts;
    }

    const fallbackPageCount = data.pageCount ?? 0;

    return {
        original: fallbackPageCount,
        exempt: 0,
        deleted: 0,
        redacted: fallbackPageCount,
    };
}

function ExportContent() {
    const searchParams = useSearchParams();
    const documentId = searchParams.get("documentId");
    const runId = searchParams.get("runId");

    const {
        isChecking: isCheckingWorkflow,
        errorVariant: workflowErrorVariant,
        isStaleRevision,
    } = useWorkflowGuard(
        "export",
        documentId,
        runId,
    );

    const [hasSupersededRevision, setHasSupersededRevision] = useState(false);

    const showStaleRevision =
        isStaleRevision || hasSupersededRevision;

    const [data, setData] = useState<ExportResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (
            !documentId ||
            !runId ||
            isCheckingWorkflow ||
            workflowErrorVariant
        ) {
            return;
        }

        const currentDocumentId = documentId;
        const currentRunId = runId;

        const controller = new AbortController();
        let isActive = true;

        async function loadExport() {

            try {
                setIsLoading(true);
                setError(null);
                setData(null);

                const result = await fetchJson<ExportResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                        currentDocumentId,
                    )}/redaction-runs/${encodeURIComponent(
                        currentRunId,
                    )}/export`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    }
                );

                if (!isActive) return;

                setData(result);
            } catch (err) {
                if (!isActive) return;

                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                if (
                    err instanceof ApiError &&
                    err.status === 409 &&
                    err.message === "Redaction run has been superseded"
                ) {
                    setHasSupersededRevision(true);
                    setData(null);
                    setError(null);
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load export details."
                );
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        }

        void loadExport();

        return () => {
            isActive = false;
            controller.abort();
        };
    }, [
        documentId,
        runId,
        isCheckingWorkflow,
        workflowErrorVariant,
    ]);

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

    const redactedDownloadUrl = showStaleRevision
        ? null
        : buildDownloadUrl(data?.redactedExportUrl);

    const vettedDownloadUrl = showStaleRevision
        ? null
        : buildDownloadUrl(data?.vettedExportUrl);

    const exemptDownloadUrl = showStaleRevision
        ? null
        : buildDownloadUrl(data?.exemptExportUrl);

    return (
        <main className="govuk-main-wrapper" id="main-content">
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    {documentId && (
                        <Link
                            href={`/review?documentId=${encodeURIComponent(documentId)}`}
                            className="govuk-back-link"
                        >
                            Back
                        </Link>
                    )}
                    <h1 className="govuk-heading-xl">Redaction complete</h1>
                    {showStaleRevision && (
                        <div
                            role="region"
                            className="moj-alert moj-alert--warning moj-alert--with-heading"
                            aria-label="warning: A newer version of this document exists"
                            data-module="moj-alert"
                        >
                            <div>
                                <svg
                                    className="moj-alert__icon"
                                    role="presentation"
                                    focusable="false"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 30 30"
                                    height="30"
                                    width="30"
                                >
                                    <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="M15 2.44922L28.75 26.1992H1.25L15 2.44922ZM13.5107 9.49579H16.4697L16.2431 17.7678H13.7461L13.5107 9.49579ZM13.1299 21.82C13.1299 21.5661 13.1787 21.3285 13.2764 21.1071C13.374 20.8793 13.5075 20.6807 13.6768 20.5114C13.8525 20.3421 14.0544 20.2087 14.2822 20.111C14.5101 20.0134 14.7542 19.9645 15.0146 19.9645C15.2686 19.9645 15.5062 20.0134 15.7275 20.111C15.9554 20.2087 16.154 20.3421 16.3232 20.5114C16.4925 20.6807 16.626 20.8793 16.7236 21.1071C16.8213 21.3285 16.8701 21.5661 16.8701 21.82C16.8701 22.0804 16.8213 22.3246 16.7236 22.5524C16.626 22.7803 16.4925 22.9789 16.3232 23.1481C16.154 23.3174 15.9554 23.4509 15.7275 23.5485C15.5062 23.6462 15.2686 23.695 15.0146 23.695C14.7542 23.695 14.5101 23.6462 14.2822 23.5485C14.0544 23.4509 13.8525 23.3174 13.6768 23.1481C13.5075 22.9789 13.374 22.7803 13.2764 22.5524C13.1787 22.3246 13.1299 22.0804 13.1299 21.82Z"
                                        fill="currentColor"
                                    />
                                </svg>
                            </div>

                            <div className="moj-alert__content">
                                <h2 className="moj-alert__heading">
                                    A newer version of this document exists
                                </h2>
                                You can no longer download files from this version.
                            </div>
                        </div>
                    )}

                    {isLoading && (
                        <section aria-live="polite">
                            <p className="govuk-body">Loading export details...</p>
                        </section>
                    )}

                    {error && (
                        <section aria-labelledby="export-error-title">
                            <div
                                className="govuk-error-summary"
                                data-module="govuk-error-summary"
                                aria-labelledby="export-error-title"
                                role="alert"
                                tabIndex={-1}
                            >
                                <h2 className="govuk-error-summary__title" id="export-error-title">
                                    There is a problem
                                </h2>

                                <div className="govuk-error-summary__body">
                                    <p className="govuk-body">{error}</p>
                                </div>
                            </div>
                        </section>
                    )}

                    {data && (
                        <>
                            <PageCountsSummary pageCounts={getPageCounts(data)} />

                            <section aria-labelledby="exported-documents-heading">
                                <table className="govuk-table">
                                    <caption
                                        className="govuk-table__caption govuk-table__caption--m"
                                        id="exported-documents-heading"
                                    >
                                        Exported documents
                                    </caption>

                                    <thead className="govuk-table__head">
                                        <tr className="govuk-table__row">
                                            <th scope="col" className="govuk-table__header">
                                                Document
                                            </th>
                                            <th scope="col" className="govuk-table__header">
                                                Description
                                            </th>
                                            <th scope="col" className="govuk-table__header">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="govuk-table__body">
                                        <ExportDocumentRow
                                            name="Vetted"
                                            description="Redactions are marked for review and all other highlights are removed."
                                            downloadUrl={vettedDownloadUrl}
                                        />

                                        <ExportDocumentRow
                                            name="Redacted"
                                            description="Redactions are applied in black and all highlights are removed."
                                            downloadUrl={redactedDownloadUrl}
                                        />

                                        {data?.exemptExportUrl && (
                                            <ExportDocumentRow
                                                name="Exempted"
                                                description="A document containing every page you marked as exempt, with all highlights removed."
                                                downloadUrl={exemptDownloadUrl}
                                            />
                                        )}
                                    </tbody>
                                </table>

                                <p className="govuk-body">
                                    <Link href="/" className="govuk-link govuk-link--no-visited-state">
                                        Upload another document
                                    </Link>
                                </p>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}

function PageCountsSummary({ pageCounts }: { pageCounts: PageCounts }) {
    return (
        <section aria-labelledby="page-counts-heading" className="page-counts-section">
            <h2 className="govuk-heading-m" id="page-counts-heading">
                Page counts
            </h2>

            <dl className="page-counts">
                <div className="page-counts__item">
                    <dt className="page-counts__number">{pageCounts.original}</dt>
                    <dd className="page-counts__label">pages in original document</dd>
                </div>

                <div className="page-counts__divider" aria-hidden="true" />

                <div className="page-counts__item">
                    <dt className="page-counts__number">{pageCounts.exempt}</dt>
                    <dd className="page-counts__label">exempt pages removed</dd>
                </div>

                <div className="page-counts__item">
                    <dt className="page-counts__number">{pageCounts.deleted}</dt>
                    <dd className="page-counts__label">pages deleted</dd>
                </div>

                <div className="page-counts__item">
                    <dt className="page-counts__number">{pageCounts.redacted}</dt>
                    <dd className="page-counts__label">pages in redacted document</dd>
                </div>
            </dl>
        </section>
    );
}

function ExportDocumentRow({
    name,
    description,
    downloadUrl,
}: {
    name: string;
    description: string;
    downloadUrl: string | null;
}) {
    return (
        <tr className="govuk-table__row">
            <th scope="row" className="govuk-table__header">
                {name}
            </th>
            <td className="govuk-table__cell">{description}</td>
            <td className="govuk-table__cell">
                {downloadUrl ? (
                    <a
                        href={downloadUrl}
                        className="govuk-link govuk-link--no-visited-state"
                        download
                    >
                        Download
                    </a>
                ) : (
                    <span className="govuk-body">Not available</span>
                )}
            </td>
        </tr>
    );
}

export default function ExportPage() {
    return (
        <Suspense fallback={null}>
            <ExportContent />
        </Suspense>
    );
}