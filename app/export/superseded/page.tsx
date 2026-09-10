"use client";

import Link from "next/link";
import {
    Suspense,
} from "react";
import {
    useSearchParams,
} from "next/navigation";

import ServiceErrorPage from "../../components/ServiceErrorPage";
import { useWorkflowGuard } from "../../lib/useWorkflowGuard";
import { buildWorkflowUrl } from "../../lib/workflowNavigation";

function SupersededExportContent() {
    const searchParams = useSearchParams();

    const documentId =
        searchParams.get("documentId");

    const runId =
        searchParams.get("runId");

    const {
        isChecking,
        workflow,
        errorVariant,
    } = useWorkflowGuard(
        "export",
        documentId,
        runId,
    );

    if (isChecking) {
        return null;
    }

    if (errorVariant) {
        return (
            <ServiceErrorPage
                variant={errorVariant}
                documentId={documentId}
            />
        );
    }

    const latestVersionUrl =
        workflow?.currentRedactionRunId
            ? buildWorkflowUrl(
                workflow.allowedPages.includes(
                    "export"
                )
                    ? "export"
                    : workflow.preferredPage,
                workflow.documentId,
                workflow.currentRedactionRunId,
            )
            : null;

    return (
        <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
                <h1 className="govuk-heading-xl">
                    There is a newer version of these files
                </h1>

                {latestVersionUrl && (
                    <p className="govuk-body">
                        <Link
                            href={latestVersionUrl}
                            className="govuk-link govuk-link--no-visited-state"
                        >
                            Go to the latest version
                        </Link>{" "}
                        to continue.
                    </p>
                )}

                <p className="govuk-body">
                    Contact the Justice Redact team if you
                    need help.
                </p>
            </div>
        </div>
    );
}

export default function SupersededExportPage() {
    return (
        <Suspense fallback={null}>
            <SupersededExportContent />
        </Suspense>
    );
}