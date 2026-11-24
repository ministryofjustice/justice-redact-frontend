// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FindAndRedactModal from "../app/review/components/FindAndRedactModal";
import FindAndPartiallyRedactModal from "../app/review/components/FindAndPartiallyRedactModal";
import FindAndDiscloseModal from "../app/review/components/FindAndDiscloseModal";

import type {
    ManualDecision,
    ReviewPageData,
} from "../app/review/types";

afterEach(() => {
    cleanup();
});

const pages: ReviewPageData[] = [{
    pageNumber: 1,
    textItems: [{
        itemId: "item-1",
        text: "0116 4546084",
        renderText: "0116 4546084",
        bbox: {
            x0: 0,
            y0: 0,
            x1: 200,
            y1: 20,
        },
    }],
    tables: [],
    images: [],
}];

const manualSelections = [{
    id: "manual-1",
    documentId: "document-1",
    kind: "text",
    pageNumber: 1,
    itemId: "item-1",
    start: 0,
    end: 12,
}] as ManualDecision[];

function renderModal(
    kind: "redact" | "partial" | "disclose"
) {
    const common = {
        isOpen: true,
        pages,
        findings: [],
        onClose: vi.fn(),
        onErrorChange: vi.fn(),
    };

    if (kind === "redact") {
        return render(
            <FindAndRedactModal
                {...common}
                manualSelections={[]}
                onHighlightSelected={vi.fn(() => 1)}
            />
        );
    }

    if (kind === "partial") {
        return render(
            <FindAndPartiallyRedactModal
                {...common}
                manualSelections={[]}
                onHighlightSelected={vi.fn(() => 1)}
            />
        );
    }

    return render(
        <FindAndDiscloseModal
            {...common}
            manualSelections={manualSelections}
            onUndoSelected={vi.fn(() => 1)}
        />
    );
}

function searchButton() {
    return screen.getByRole("button", {
        name: "Search",
    }) as HTMLButtonElement;
}

function enterSearch(value: string) {
    const input = screen.getByRole("textbox");
    fireEvent.change(input, {
        target: { value },
    });
}

function expectNoValidationErrors(container: HTMLElement) {
    expect(
        container.querySelector(".govuk-error-summary")
    ).toBeNull();

    expect(
        container.querySelector(".govuk-error-message")
    ).toBeNull();

    expect(
        container.querySelector("[aria-invalid='true']")
    ).toBeNull();
}

describe.each([
    "redact",
    "partial",
    "disclose",
] as const)("%s modal disabled actions", (kind) => {
    it("disables Search for empty and whitespace-only input", () => {
        const { container } = renderModal(kind);

        expect(searchButton().disabled).toBe(true);

        enterSearch("   ");

        expect(searchButton().disabled).toBe(true);
        expectNoValidationErrors(container);

        enterSearch("0116");

        expect(searchButton().disabled).toBe(false);
        expectNoValidationErrors(container);
    });

    it("does not create validation errors on an invalid form submit", () => {
        const { container } = renderModal(kind);

        const form = container.querySelector("form")
            ?? document.querySelector("form");

        expect(form).not.toBeNull();

        fireEvent.submit(form!);

        expect(searchButton().disabled).toBe(true);
        expectNoValidationErrors(container);
    });
});

describe("disabled selection actions", () => {
    it("disables Redact until a result is selected", () => {
        const { container } = renderModal("redact");

        enterSearch("0116");
        fireEvent.click(searchButton());

        const redact = screen.getByRole("button", {
            name: "Redact",
        }) as HTMLButtonElement;

        expect(redact.disabled).toBe(true);
        expectNoValidationErrors(container);
    });

    it("disables Continue until a partial text range is selected", () => {
        const { container } = renderModal("partial");

        enterSearch("0116");
        fireEvent.click(searchButton());

        const button = screen.getByRole("button", {
            name: "Continue",
        }) as HTMLButtonElement;

        expect(button.disabled).toBe(true);
        expectNoValidationErrors(container);
    });

    it("disables Remove until a redaction result is selected", () => {
        const { container } = renderModal("disclose");

        enterSearch("0116");
        fireEvent.click(searchButton());

        const remove = screen.getByRole("button", {
            name: "Remove",
        }) as HTMLButtonElement;

        expect(remove.disabled).toBe(true);
        expectNoValidationErrors(container);
    });
});
