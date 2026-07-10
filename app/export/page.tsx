"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson } from "../lib/api";

type PageCounts = {
    original: number;
    exempt: number;
    deleted: number;
    redacted: number;
};

type ExportResponse = {
    documentId: string;
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

    const [data, setData] = useState<ExportResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        let isActive = true;

        async function loadExport() {
            if (!documentId) {
                setError("Missing document ID.");
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                setData(null);

                const result = await fetchJson<ExportResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${documentId}/export`,
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
    }, [documentId]);

    const redactedDownloadUrl = buildDownloadUrl(data?.redactedExportUrl);
    const vettedDownloadUrl = buildDownloadUrl(data?.vettedExportUrl);
    const exemptDownloadUrl = buildDownloadUrl(data?.exemptExportUrl);

    return (
        <main className="govuk-main-wrapper" id="main-content">
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <h1 className="govuk-heading-xl">Redaction complete</h1>

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

                                        {exemptDownloadUrl && (
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
        <Suspense
            fallback={
                <main className="govuk-main-wrapper" id="main-content">
                    <div className="govuk-grid-row">
                        <div className="govuk-grid-column-two-thirds">
                            <p className="govuk-body" role="status" aria-live="polite">
                                Loading export page...
                            </p>
                        </div>
                    </div>
                </main>
            }
        >
            <ExportContent />
        </Suspense>
    );
}