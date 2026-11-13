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
} from "vitest";

import ApplyRedactionsFailureAlert from "../app/review/components/ApplyRedactionsFailureAlert";
import {
    consumeApplyRedactionsFailure,
    setApplyRedactionsFailure,
} from "../app/lib/applyRedactionsFailure";

beforeEach(() => {
    window.sessionStorage.clear();
});

afterEach(() => {
    cleanup();
});

describe("Apply Redactions failure alert", () => {
    it("renders and focuses the designed MOJ error alert", async () => {
        render(<ApplyRedactionsFailureAlert />);

        const alert = screen.getByRole("region", {
            name: "error: There was a problem applying redactions",
        });

        expect(alert).toBeTruthy();

        await waitFor(() => {
            expect(document.activeElement).toBe(alert);
        });

        expect(
            screen.getByRole("heading", {
                name: "There was a problem applying redactions",
            }),
        ).toBeTruthy();

        expect(
            screen.getByText(/Try again or/),
        ).toBeTruthy();

        const contactLink = screen.getByRole(
            "link",
            {
                name: "contact the Justice Redact team",
            },
        );

        expect(
            contactLink.getAttribute("href"),
        ).toBe("/contact");

        expect(
            screen.getByText(/if you need help\./),
        ).toBeTruthy();
    });
});

describe("Apply Redactions failure state", () => {
    it("stores and consumes the failure for the same document once", () => {
        setApplyRedactionsFailure(
            "document-123",
        );

        expect(
            consumeApplyRedactionsFailure(
                "document-123",
            ),
        ).toBe(true);

        expect(
            consumeApplyRedactionsFailure(
                "document-123",
            ),
        ).toBe(false);
    });

    it("does not consume another document's failure", () => {
        setApplyRedactionsFailure(
            "document-123",
        );

        expect(
            consumeApplyRedactionsFailure(
                "document-456",
            ),
        ).toBe(false);

        expect(
            consumeApplyRedactionsFailure(
                "document-123",
            ),
        ).toBe(true);
    });
});