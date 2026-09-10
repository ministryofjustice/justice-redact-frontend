"use client";

import Link from "next/link";
import {
    Suspense,
    useEffect,
    useState,
} from "react";
import {
    useRouter,
    useSearchParams,
} from "next/navigation";

import {
    ApiError,
    fetchJson,
} from "../lib/api";

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
    allFilesExportUrl?: string;

    pageCount?: number;
    pageCounts?: PageCounts;
};

function buildDownloadUrl(
    path?: string | null
) {
    if (!path) {
        return null;
    }

    return (
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`
    );
}

function buildSupersededUrl(
    documentId: string,
    runId: string
) {
    return (
        `/export/superseded?documentId=${encodeURIComponent(
            documentId
        )}&runId=${encodeURIComponent(runId)}`
    );
}

function getPageCounts(
    data: ExportResponse
): PageCounts {
    if (data.pageCounts) {
        return data.pageCounts;
    }

    const fallbackPageCount =
        data.pageCount ?? 0;

    return {
        original: fallbackPageCount,
        exempt: 0,
        deleted: 0,
        redacted: fallbackPageCount,
    };
}

function ExportContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const documentId =
        searchParams.get("documentId");

    const runId =
        searchParams.get("runId");

    const {
        isChecking: isCheckingWorkflow,
        errorVariant: workflowErrorVariant,
        isStaleRevision,
    } = useWorkflowGuard(
        "export",
        documentId,
        runId,
    );

    const [data, setData] =
        useState<ExportResponse | null>(null);

    const [isLoading, setIsLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        if (
            isCheckingWorkflow ||
            !isStaleRevision ||
            !documentId ||
            !runId
        ) {
            return;
        }

        router.replace(
            buildSupersededUrl(
                documentId,
                runId
            )
        );
    }, [
        documentId,
        runId,
        isCheckingWorkflow,
        isStaleRevision,
        router,
    ]);

    useEffect(() => {
        if (
            !documentId ||
            !runId ||
            isCheckingWorkflow ||
            workflowErrorVariant ||
            isStaleRevision
        ) {
            return;
        }

        const currentDocumentId =
            documentId;

        const currentRunId =
            runId;

        const controller =
            new AbortController();

        let isActive = true;

        async function loadExport() {
            try {
                setIsLoading(true);
                setError(null);
                setData(null);

                const result =
                    await fetchJson<ExportResponse>(
                        `${process.env.NEXT_PUBLIC_API_BASE_URL}/documents/${encodeURIComponent(
                            currentDocumentId
                        )}/redaction-runs/${encodeURIComponent(
                            currentRunId
                        )}/export`,
                        {
                            cache: "no-store",
                            signal: controller.signal,
                        }
                    );

                if (!isActive) {
                    return;
                }

                setData(result);
            } catch (err) {
                if (!isActive) {
                    return;
                }

                if (
                    err instanceof DOMException &&
                    err.name === "AbortError"
                ) {
                    return;
                }

                if (
                    err instanceof ApiError &&
                    err.status === 409 &&
                    err.message ===
                    "Redaction run has been superseded"
                ) {
                    router.replace(
                        buildSupersededUrl(
                            currentDocumentId,
                            currentRunId
                        )
                    );

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
        isStaleRevision,
        router,
    ]);

    if (
        isCheckingWorkflow ||
        isStaleRevision
    ) {
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

    if (isLoading) {
        return (
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <p className="govuk-body">
                        Loading export details...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <div
                        className="govuk-error-summary"
                        data-module="govuk-error-summary"
                        aria-labelledby="export-error-title"
                        role="alert"
                        tabIndex={-1}
                    >
                        <h2
                            className="govuk-error-summary__title"
                            id="export-error-title"
                        >
                            There is a problem
                        </h2>

                        <div className="govuk-error-summary__body">
                            <p className="govuk-body">
                                {error}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const allFilesDownloadUrl =
        buildDownloadUrl(
            data.allFilesExportUrl
        );

    return (
        <>
            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <div className="govuk-panel govuk-panel--confirmation">
                        <h1 className="govuk-panel__title">
                            Redactions applied
                        </h1>
                    </div>

                    <hr className="govuk-section-break govuk-section-break--m govuk-section-break--invisible" />
                </div>
            </div>

            <div className="govuk-grid-row">
                <div className="govuk-grid-column-two-thirds">
                    <h2 className="govuk-heading-m">
                        Files
                    </h2>

                    <table className="govuk-table">
                        <thead className="govuk-table__head">
                            <tr className="govuk-table__row">
                                <th
                                    scope="col"
                                    className="govuk-table__header govuk-!-width-one-quarter"
                                >
                                    File type
                                </th>

                                <th
                                    scope="col"
                                    className="govuk-table__header"
                                >
                                    Description
                                </th>
                            </tr>
                        </thead>

                        <tbody className="govuk-table__body">
                            <tr className="govuk-table__row">
                                <th
                                    scope="row"
                                    className="govuk-table__header"
                                >
                                    Redacted
                                </th>

                                <td className="govuk-table__cell">
                                    <p className="govuk-body jr-export-file-description">
                                        Fully sanitised with redactions
                                        blacked out and no AI suggestions
                                        highlighted.
                                    </p>

                                    <details className="govuk-details jr-export-sanitisation-details">
                                        <summary className="govuk-details__summary">
                                            <span className="govuk-details__summary-text">
                                                More about sanitisation
                                            </span>
                                        </summary>

                                        <div className="govuk-details__text">
                                            Sanitisation removes hidden
                                            details like author names,
                                            comments, or edit history. This
                                            means that the file can be shared
                                            safely.
                                        </div>
                                    </details>
                                </td>
                            </tr>

                            <tr className="govuk-table__row">
                                <th
                                    scope="row"
                                    className="govuk-table__header"
                                >
                                    Vetted
                                </th>

                                <td className="govuk-table__cell">
                                    Highlights show what you redacted and
                                    what the AI suggested.
                                </td>
                            </tr>

                            <tr className="govuk-table__row">
                                <th
                                    scope="row"
                                    className="govuk-table__header"
                                >
                                    Exempted
                                </th>

                                <td className="govuk-table__cell">
                                    All the pages you exempted with AI
                                    suggestions highlighted.
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {allFilesDownloadUrl && (
                        <a
                            href={allFilesDownloadUrl}
                            role="button"
                            draggable={false}
                            className="govuk-button"
                            data-module="govuk-button"
                        >
                            Download all files
                        </a>
                    )}

                    <hr className="govuk-section-break govuk-section-break--m govuk-section-break--invisible" />

                    <PageCountsSummary
                        pageCounts={getPageCounts(data)}
                    />

                    <p className="govuk-body">
                        <Link
                            href="/upload"
                            className="govuk-link govuk-link--no-visited-state"
                        >
                            Upload another file
                        </Link>
                    </p>
                </div>
            </div>
        </>
    );
}

function PageCountsSummary({
    pageCounts,
}: {
    pageCounts: PageCounts;
}) {
    return (
        <section
            aria-labelledby="page-counts-heading"
            className="jr-export-page-counts-section"
        >
            <h2
                className="govuk-heading-m"
                id="page-counts-heading"
            >
                Page count summary
            </h2>

            <div className="jr-export-page-counts">
                <div className="jr-export-page-counts__item jr-export-page-counts__item--original">
                    <p className="govuk-heading-l jr-export-page-counts__number">
                        {pageCounts.original}
                    </p>

                    <p className="govuk-body jr-export-page-counts__label">
                        pages in
                        <br />
                        original file
                    </p>
                </div>

                <div
                    className="jr-export-page-counts__divider"
                    aria-hidden="true"
                />

                <div className="jr-export-page-counts__item">
                    <p className="govuk-heading-l jr-export-page-counts__number">
                        {pageCounts.exempt}
                    </p>

                    <p className="govuk-body jr-export-page-counts__label">
                        exempt pages
                        <br />
                        removed
                    </p>
                </div>

                <div className="jr-export-page-counts__item">
                    <p className="govuk-heading-l jr-export-page-counts__number">
                        {pageCounts.deleted}
                    </p>

                    <p className="govuk-body jr-export-page-counts__label">
                        pages
                        <br />
                        deleted
                    </p>
                </div>

                <div className="jr-export-page-counts__item">
                    <p className="govuk-heading-l jr-export-page-counts__number">
                        {pageCounts.redacted}
                    </p>

                    <p className="govuk-body jr-export-page-counts__label">
                        pages in redacted
                        <br />
                        file
                    </p>
                </div>
            </div>
        </section>
    );
}

export default function ExportPage() {
    return (
        <Suspense fallback={null}>
            <ExportContent />
        </Suspense>
    );
}