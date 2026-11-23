// @vitest-environment jsdom

import {
    cleanup,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";

import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import EndOfDocumentActions from "../app/review/components/EndOfDocumentActions";

afterEach(() => {
    cleanup();
});

describe("EndOfDocumentActions", () => {
    it("keeps Apply enabled when no changes have been made", () => {
        const onApplyRedactions = vi.fn();

        render(
            <EndOfDocumentActions
                isApplyingRedactions={false}
                error={null}
                onApplyRedactions={onApplyRedactions}
            />,
        );

        const button = screen.getByRole("button", {
            name: "Apply redactions",
        }) as HTMLButtonElement;

        expect(button.disabled).toBe(false);

        fireEvent.click(button);

        expect(onApplyRedactions)
            .toHaveBeenCalledTimes(1);
    });

    it("prevents duplicate clicks while applying", () => {
        const onApplyRedactions = vi.fn();

        render(
            <EndOfDocumentActions
                isApplyingRedactions={true}
                error={null}
                onApplyRedactions={onApplyRedactions}
            />,
        );

        const button = screen.getByRole("button", {
            name: "Applying redactions…",
        }) as HTMLButtonElement;

        expect(button.disabled).toBe(true);

        fireEvent.click(button);

        expect(onApplyRedactions)
            .not.toHaveBeenCalled();
    });
});
