// @vitest-environment jsdom

import {
    cleanup,
    render,
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

import ApplyingRedactionsPage from "../app/applying-redactions/page";
import {
    ApiError,
    fetchJson,
} from "../app/lib/api";
import {
    consumeApplyRedactionsFailure,
} from "../app/lib/applyRedactionsFailure";
import {
    useWorkflowGuard,
} from "../app/lib/useWorkflowGuard";

const router = vi.hoisted(() => ({
    push: vi.fn(),
    replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => router,
    useSearchParams: () => ({
        get: (name: string) => {
            if (name === "documentId") {
                return "document-123";
            }

            if (name === "runId") {
                return "run-123";
            }

            return null;
        },
    }),
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

vi.mock(
    "../app/lib/useWorkflowGuard",
    () => ({
        useWorkflowGuard: vi.fn(),
    }),
);

const mockedFetchJson = vi.mocked(fetchJson);
const mockedUseWorkflowGuard =
    vi.mocked(useWorkflowGuard);

beforeEach(() => {
    Object.defineProperty(
        window,
        "matchMedia",
        {
            writable: true,
            value: vi.fn().mockImplementation(
                (query: string) => ({
                    matches: false,
                    media: query,
                    onchange: null,
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                }),
            ),
        },
    );

    mockedFetchJson.mockReset();
    mockedUseWorkflowGuard.mockReset();

    router.push.mockReset();
    router.replace.mockReset();

    window.sessionStorage.clear();

    mockedUseWorkflowGuard.mockReturnValue({
        isChecking: false,
        workflow: null,
        errorVariant: null,
        isStaleRevision: false,
    });

    process.env.NEXT_PUBLIC_API_BASE_URL =
        "http://localhost:8000";

    vi.spyOn(
        console,
        "error",
    ).mockImplementation(() => { });
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("Apply Redactions failure recovery", () => {
    it("returns to review with an error alert when the run fails", async () => {
        mockedFetchJson.mockResolvedValueOnce({
            documentId: "document-123",
            runId: "run-123",
            status: "failed",
            processingProgress: 100,
        });

        render(
            <ApplyingRedactionsPage />,
        );

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith(
                "/review?documentId=document-123",
            );
        });

        expect(
            consumeApplyRedactionsFailure(
                "document-123",
            ),
        ).toBe(true);
    });

    it("cancels the active run before returning to review when status polling fails", async () => {
        mockedFetchJson
            .mockRejectedValueOnce(
                new ApiError(
                    "Service unavailable",
                    503,
                    true,
                ),
            )
            .mockResolvedValueOnce({
                documentId: "document-123",
                runId: "run-123",
                status: "cancelled",
            });

        render(
            <ApplyingRedactionsPage />,
        );

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith(
                "/review?documentId=document-123",
            );
        });

        expect(
            mockedFetchJson,
        ).toHaveBeenCalledTimes(2);

        expect(
            mockedFetchJson.mock.calls[1][0],
        ).toBe(
            "http://localhost:8000/documents/document-123/redaction-runs/run-123/cancel",
        );

        expect(
            consumeApplyRedactionsFailure(
                "document-123",
            ),
        ).toBe(true);
    });

    it("goes to export without showing an error if the run completed while cancellation was attempted", async () => {
        mockedFetchJson
            .mockRejectedValueOnce(
                new ApiError(
                    "Service unavailable",
                    503,
                    true,
                ),
            )
            .mockRejectedValueOnce(
                new ApiError(
                    "Run is no longer active",
                    409,
                    false,
                ),
            )
            .mockResolvedValueOnce({
                documentId: "document-123",
                status: "redaction_complete",
                preferredPage: "export",
                currentRedactionRunId:
                    "run-123",
                allowedPages: [
                    "review",
                    "export",
                ],
            });

        render(
            <ApplyingRedactionsPage />,
        );

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith(
                "/export?documentId=document-123&runId=run-123",
            );
        });

        expect(
            consumeApplyRedactionsFailure(
                "document-123",
            ),
        ).toBe(false);
    });

    it("returns to review with an error when the workflow confirms the run failed", async () => {
        mockedFetchJson
            .mockRejectedValueOnce(
                new ApiError(
                    "Service unavailable",
                    503,
                    true,
                ),
            )
            .mockRejectedValueOnce(
                new ApiError(
                    "Run is no longer active",
                    409,
                    false,
                ),
            )
            .mockResolvedValueOnce({
                documentId: "document-123",
                status: "redaction_failed",
                preferredPage: "review",
                currentRedactionRunId:
                    "run-123",
                allowedPages: [
                    "review",
                    "applying-redactions",
                ],
            });

        render(
            <ApplyingRedactionsPage />,
        );

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith(
                "/review?documentId=document-123",
            );
        });

        expect(
            consumeApplyRedactionsFailure(
                "document-123",
            ),
        ).toBe(true);
    });

    it("returns to review without an error alert when the run was cancelled", async () => {
        mockedFetchJson.mockResolvedValueOnce({
            documentId: "document-123",
            runId: "run-123",
            status: "cancelled",
            processingProgress: 30,
        });

        render(
            <ApplyingRedactionsPage />,
        );

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith(
                "/review?documentId=document-123",
            );
        });

        expect(
            consumeApplyRedactionsFailure(
                "document-123",
            ),
        ).toBe(false);
    });
});