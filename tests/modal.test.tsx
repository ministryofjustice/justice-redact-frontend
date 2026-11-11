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

import Modal from "../app/review/components/Modal";

afterEach(() => {
    cleanup();

    document
        .querySelectorAll("[data-modal-test-background]")
        .forEach((element) => element.remove());

    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";

    vi.unstubAllGlobals();
});

for (const variant of ["standard", "content-dense"] as const) {
    describe(`${variant} modal`, () => {
        it("makes the background inert, traps focus and restores state on close", () => {
            vi.stubGlobal(
                "requestAnimationFrame",
                (callback: FrameRequestCallback) => {
                    callback(0);
                    return 1;
                },
            );

            document.documentElement.style.overflow = "scroll";
            document.body.style.overflow = "auto";

            const background = document.createElement("div");
            background.dataset.modalTestBackground = "true";
            background.inert = false;
            background.setAttribute("aria-hidden", "false");

            const trigger = document.createElement("button");
            trigger.textContent = "Open modal";
            background.appendChild(trigger);
            document.body.appendChild(background);
            trigger.focus();

            const onClose = vi.fn();

            const { rerender } = render(
                <Modal
                    isOpen
                    variant={variant}
                    title="Review actions"
                    onClose={onClose}
                >
                    <button type="button">Confirm</button>
                </Modal>,
            );

            const dialog = screen.getByRole("dialog", {
                name: "Review actions",
            });

            const closeButton = screen.getByRole("button", {
                name: "Close Review actions",
            });

            const confirmButton = screen.getByRole("button", {
                name: "Confirm",
            });

            expect(dialog.classList.contains(
                `jr-modal--${variant}`,
            )).toBe(true);

            // Background is inaccessible and scrolling is locked.
            expect(background.inert).toBe(true);
            expect(background.getAttribute("aria-hidden"))
                .toBe("true");

            expect(document.documentElement.style.overflow)
                .toBe("hidden");

            expect(document.body.style.overflow)
                .toBe("hidden");

            // Keyboard focus stays within the modal.
            expect(document.activeElement).toBe(closeButton);

            fireEvent.keyDown(dialog, {
                key: "Tab",
                shiftKey: true,
            });

            expect(document.activeElement).toBe(confirmButton);

            fireEvent.keyDown(dialog, {
                key: "Tab",
            });

            expect(document.activeElement).toBe(closeButton);

            // Escape requests closure.
            fireEvent.keyDown(dialog, {
                key: "Escape",
            });

            expect(onClose).toHaveBeenCalledOnce();

            // Closing restores the original document state.
            rerender(
                <Modal
                    isOpen={false}
                    variant={variant}
                    title="Review actions"
                    onClose={onClose}
                >
                    <button type="button">Confirm</button>
                </Modal>,
            );

            expect(background.inert).toBe(false);

            expect(background.getAttribute("aria-hidden"))
                .toBe("false");

            expect(document.documentElement.style.overflow)
                .toBe("scroll");

            expect(document.body.style.overflow)
                .toBe("auto");

            expect(document.activeElement).toBe(trigger);
        });
    });
}
