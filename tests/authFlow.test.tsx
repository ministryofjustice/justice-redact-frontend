// @vitest-environment jsdom

import {
    cleanup,
    fireEvent,
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

import StartPage from "../app/page";
import CheckEmailPage from "../app/check-email/page";
import ConfirmEmailPage from "../app/confirm-email/page";
import ResendEmailPage from "../app/resend-email/page";
import {
    ApiError,
    fetchJson,
} from "../app/lib/api";
import {
    getVerificationEmail,
    setVerificationEmail,
} from "../app/lib/verificationEmail";

const router = vi.hoisted(() => ({
    push: vi.fn(),
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

function unauthorizedError() {
    return new ApiError(
        "Authentication required.",
        401,
        false,
    );
}

beforeEach(() => {
    mockedFetchJson.mockReset();
    router.push.mockReset();
    router.replace.mockReset();

    window.sessionStorage.clear();

    window.history.replaceState(
        {},
        "",
        "/",
    );

    process.env.NEXT_PUBLIC_API_BASE_URL =
        "http://localhost:8000";
});

afterEach(() => {
    cleanup();
});

describe("authentication start page", () => {
    it("redirects an existing authenticated user to upload", async () => {
        mockedFetchJson.mockResolvedValueOnce({
            userId: "user-123",
            email: "vetter@justice.gov.uk",
        });

        render(<StartPage />);

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith("/upload");
        });
    });

    it("shows the designed validation state for an invalid email", async () => {
        mockedFetchJson.mockRejectedValueOnce(
            unauthorizedError(),
        );

        render(<StartPage />);

        await screen.findByRole(
            "heading",
            {
                name: "Start using Justice Redact",
            },
        );

        fireEvent.change(
            screen.getByLabelText(
                "Enter your justice.gov.uk email address",
            ),
            {
                target: {
                    value: "someone@example.com",
                },
            },
        );

        fireEvent.click(
            screen.getByRole(
                "button",
                {
                    name: "Send email",
                },
            ),
        );

        const errorMessage =
            "Enter an email address in the format name@justice.gov.uk";

        const errorSummary =
            screen.getByRole("alert");

        expect(
            errorSummary.textContent,
        ).toContain("There is a problem");

        expect(
            errorSummary.textContent,
        ).toContain(errorMessage);

        expect(
            document
                .getElementById("email-error")
                ?.textContent,
        ).toContain(errorMessage);

        const input =
            screen.getByLabelText(
                "Enter your justice.gov.uk email address",
            ) as HTMLInputElement;

        expect(
            input.className,
        ).toContain("govuk-input--error");
    });

    it("sends a valid Justice email to the check email page", async () => {
        mockedFetchJson
            .mockRejectedValueOnce(
                unauthorizedError(),
            )
            .mockResolvedValueOnce({
                status: "verification_email_sent",
            });

        render(<StartPage />);

        await screen.findByRole(
            "heading",
            {
                name: "Start using Justice Redact",
            },
        );

        fireEvent.change(
            screen.getByLabelText(
                "Enter your justice.gov.uk email address",
            ),
            {
                target: {
                    value: "vetter@justice.gov.uk",
                },
            },
        );

        fireEvent.click(
            screen.getByRole(
                "button",
                {
                    name: "Send email",
                },
            ),
        );

        await waitFor(() => {
            expect(
                router.push,
            ).toHaveBeenCalledWith(
                "/check-email",
            );
        });

        expect(
            getVerificationEmail(),
        ).toBe("vetter@justice.gov.uk");

        expect(
            router.push,
        ).not.toHaveBeenCalledWith(
            "/access-denied",
        );
    });
});

describe("confirmation link", () => {
    it("redirects successful verification to upload", async () => {
        setVerificationEmail(
            "vetter@justice.gov.uk",
        );

        window.history.replaceState(
            {},
            "",
            "/confirm-email#token=email-secret",
        );

        mockedFetchJson.mockResolvedValueOnce({
            userId: "user-123",
            email: "vetter@justice.gov.uk",
            expiresAt:
                "2026-10-06T12:00:00+00:00",
        });

        render(<ConfirmEmailPage />);

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith("/upload");
        });

        expect(
            getVerificationEmail(),
        ).toBeNull();

        expect(
            window.location.hash,
        ).toBe("");
    });

    it("redirects a verified user without Private Beta access to access denied", async () => {
        setVerificationEmail(
            "vetter@justice.gov.uk",
        );

        window.history.replaceState(
            {},
            "",
            "/confirm-email#token=email-secret",
        );

        mockedFetchJson.mockRejectedValueOnce(
            new ApiError(
                "You cannot use Justice Redact yet",
                403,
                false,
            ),
        );

        render(<ConfirmEmailPage />);

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith(
                "/access-denied",
            );
        });

        expect(
            getVerificationEmail(),
        ).toBeNull();

        expect(
            window.location.hash,
        ).toBe("");
    });

    it("shows did not work when the backend rejects an unusable link", async () => {
        window.history.replaceState(
            {},
            "",
            "/confirm-email#token=email-secret",
        );

        mockedFetchJson.mockRejectedValueOnce(
            new ApiError(
                "The confirmation link did not work",
                400,
                false,
            ),
        );

        render(<ConfirmEmailPage />);

        await screen.findByRole(
            "heading",
            {
                name:
                    "Your confirmation link did not work",
            },
        );
    });

    it("shows not recognised for an unknown confirmation token", async () => {
        window.history.replaceState(
            {},
            "",
            "/confirm-email#token=unknown-token",
        );

        mockedFetchJson.mockRejectedValueOnce(
            new ApiError(
                "The confirmation link was not recognised",
                400,
                false,
            ),
        );

        render(<ConfirmEmailPage />);

        await screen.findByRole(
            "heading",
            {
                name:
                    "Your confirmation link was not recognised",
            },
        );
    });

    it("shows did not work when the confirmation URL has no token", async () => {
        window.history.replaceState(
            {},
            "",
            "/confirm-email",
        );

        render(<ConfirmEmailPage />);

        await screen.findByRole(
            "heading",
            {
                name:
                    "Your confirmation link did not work",
            },
        );

        expect(
            mockedFetchJson,
        ).not.toHaveBeenCalled();
    });
});

describe("email journey pages", () => {
    it("returns to the start page when check-email has no stored email", async () => {
        render(<CheckEmailPage />);

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith("/");
        });
    });

    it("returns to the start page when resend-email has no stored email", async () => {
        render(<ResendEmailPage />);

        await waitFor(() => {
            expect(
                router.replace,
            ).toHaveBeenCalledWith("/");
        });
    });
});
