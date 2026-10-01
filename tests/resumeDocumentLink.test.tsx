// @vitest-environment jsdom

import {
    cleanup,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import ServiceErrorPage from "../app/components/ServiceErrorPage";
import {
    ApiError,
    fetchJson,
} from "../app/lib/api";
import {
    useWorkflowGuard,
} from "../app/lib/useWorkflowGuard";
import type {
    WorkflowPage,
} from "../app/lib/workflowNavigation";

const router = vi.hoisted(() => ({
    replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => router,
}));

vi.mock(
    "../app/lib/api",
    async (importOriginal) => {
        const actual =
            await importOriginal<
                typeof import("../app/lib/api")
            >();

        return {
            ...actual,
            fetchJson: vi.fn(),
        };
    },
);

const mockedFetchJson = vi.mocked(fetchJson);

function WorkflowGuardHarness({
    currentPage,
}: {
    currentPage: WorkflowPage;
}) {
    const {
        isChecking,
        errorVariant,
    } = useWorkflowGuard(
        currentPage,
        "document-123",
    );

    if (isChecking) {
        return <div>Checking</div>;
    }

    if (errorVariant) {
        return (
            <ServiceErrorPage
                variant={errorVariant}
            />
        );
    }

    return <div>Allowed</div>;
}

beforeEach(() => {
    mockedFetchJson.mockReset();
    router.replace.mockReset();

    process.env.NEXT_PUBLIC_API_BASE_URL =
        "http://localhost:8000";
});

afterEach(() => {
    cleanup();
});

describe("resume document links", () => {
    it("shows the not-recognised screen when review access returns 404", async () => {
        mockedFetchJson.mockRejectedValueOnce(
            new ApiError(
                "Document not found",
                404,
                false,
            ),
        );

        render(
            <WorkflowGuardHarness
                currentPage="review"
            />,
        );

        expect(
            await screen.findByRole(
                "heading",
                {
                    name:
                        "Your link was not recognised",
                },
            ),
        ).toBeTruthy();

        expect(
            screen.getByText(
                "Go back to the email and select the link again.",
            ),
        ).toBeTruthy();

        expect(
            screen.getByText(
                "You need to open the link in the same browser you're on now.",
            ),
        ).toBeTruthy();

        expect(
            screen.queryByText(
                "Contact the Justice Redact team",
            ),
        ).toBeNull();
    });

    it("shows the expired screen when review access returns 410", async () => {
        mockedFetchJson.mockRejectedValueOnce(
            new ApiError(
                "Document link expired",
                410,
                false,
            ),
        );

        render(
            <WorkflowGuardHarness
                currentPage="review"
            />,
        );

        expect(
            await screen.findByRole(
                "heading",
                {
                    name:
                        "Your link has expired",
                },
            ),
        ).toBeTruthy();

        expect(
            screen.getByText(
                "You cannot edit this file because the link you selected is more than 30 days old.",
            ),
        ).toBeTruthy();

        expect(
            screen.getByText(
                "Instead, use Adobe Acrobat to make changes to the document - you'll need to sanitise the document when exporting it.",
            ),
        ).toBeTruthy();

        expect(
            screen.queryByText(
                "Contact the Justice Redact team",
            ),
        ).toBeNull();
    });

    it("keeps a normal 404 error for non-review workflow pages", async () => {
        mockedFetchJson.mockRejectedValueOnce(
            new ApiError(
                "Document not found",
                404,
                false,
            ),
        );

        render(
            <WorkflowGuardHarness
                currentPage="processing"
            />,
        );

        expect(
            await screen.findByRole(
                "heading",
                {
                    name: "Page not found",
                },
            ),
        ).toBeTruthy();

        expect(
            screen.queryByRole(
                "heading",
                {
                    name:
                        "Your link was not recognised",
                },
            ),
        ).toBeNull();
    });

    it("allows a valid owned document that has not expired", async () => {
        mockedFetchJson.mockResolvedValueOnce({
            documentId: "document-123",
            status: "ready_for_review",
            currentRedactionRunId: null,
            preferredPage: "review",
            allowedPages: [
                "review",
            ],
        });

        render(
            <WorkflowGuardHarness
                currentPage="review"
            />,
        );

        await waitFor(() => {
            expect(
                screen.getByText("Allowed"),
            ).toBeTruthy();
        });

        expect(
            router.replace,
        ).not.toHaveBeenCalled();
    });
});