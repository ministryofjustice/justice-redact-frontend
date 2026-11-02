// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    useRedactionInteractions,
} from "../features/documents/review/useRedactionInteractions";

import type {
    ManualDecision,
    ManualTextDecision,
} from "../app/review/types";

function makeTextDecision(
    id: string,
    groupId?: string,
): ManualTextDecision {
    return {
        id,
        documentId: "test-document",
        kind: "text",
        pageNumber: 1,
        itemId: `item-${id}`,
        start: 0,
        end: 3,
        text: "cat",
        ...(groupId
            ? { redactionGroupId: groupId }
            : {}),
    };
}

function renderInteractions(
    initialSelections: ManualDecision[],
) {
    return renderHook(() => {
        const [
            selections,
            setManualSelections,
        ] = useState(initialSelections);

        const interactions = useRedactionInteractions({
            isRedactMode: true,
            setManualSelections,
        });

        return {
            selections,
            ...interactions,
        };
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Redaction interactions", () => {
    it("removes an entire logical redaction group while preserving other groups and images", () => {
        const left = makeTextDecision(
            "left",
            "shared-group",
        );

        const right = makeTextDecision(
            "right",
            "shared-group",
        );

        const unrelated = makeTextDecision(
            "unrelated",
            "other-group",
        );

        const image: ManualDecision = {
            id: "image-one",
            documentId: "test-document",
            kind: "image",
            pageNumber: 1,
            imageId: "image-1",
        };

        const { result, unmount } = renderInteractions([
            left,
            right,
            unrelated,
            image,
        ]);

        act(() => {
            result.current.removeManualSelection(
                "left",
                "shared-group",
            );
        });

        expect(
            result.current.selections.map(
                (selection) => selection.id,
            ),
        ).toEqual(["unrelated", "image-one"]);

        unmount();
    });

    it("removes only the specified manual decision when there is no group ID", () => {
        const first = makeTextDecision("first");
        const second = makeTextDecision("second");

        const { result, unmount } = renderInteractions([
            first,
            second,
        ]);

        act(() => {
            result.current.removeManualSelection(
                "first",
                null,
            );
        });

        expect(result.current.selections).toEqual([
            second,
        ]);

        unmount();
    });

    it("opens the context menu and dismisses it on an outside click", () => {
        const trigger = document.createElement("button");

        trigger.dataset.manualId = "redaction-1";
        trigger.dataset.redactionGroupId = "group-1";

        document.body.appendChild(trigger);

        const { result, unmount } = renderInteractions([
            makeTextDecision(
                "redaction-1",
                "group-1",
            ),
        ]);

        const preventDefault = vi.fn();

        act(() => {
            result.current.handleRedactionContextMenu({
                target: trigger,
                clientX: 120,
                clientY: 80,
                preventDefault,
            } as unknown as ReactMouseEvent<HTMLElement>);
        });

        expect(preventDefault).toHaveBeenCalledOnce();

        expect(result.current.redactionRemoveMenu)
            .toEqual({
                manualId: "redaction-1",
                redactionGroupId: "group-1",
                x: 120,
                y: 80,
            });

        act(() => {
            document.body.dispatchEvent(
                new globalThis.MouseEvent(
                    "mousedown",
                    { bubbles: true },
                ),
            );
        });

        expect(result.current.redactionRemoveMenu)
            .toBeNull();

        unmount();
        trigger.remove();
    });

    it("clears group hover and restores trigger focus when Escape dismisses the menu", () => {
        const first = document.createElement("button");
        const second = document.createElement("button");

        first.dataset.manualId = "first";
        first.dataset.redactionGroupId = "shared";

        second.dataset.manualId = "second";
        second.dataset.redactionGroupId = "shared";

        document.body.append(first, second);

        vi.stubGlobal(
            "requestAnimationFrame",
            (callback: FrameRequestCallback) => {
                callback(0);
                return 1;
            },
        );

        const { result, unmount } = renderInteractions([
            makeTextDecision("first", "shared"),
            makeTextDecision("second", "shared"),
        ]);

        act(() => {
            result.current.handleRedactionContextMenu({
                target: first,
                clientX: 10,
                clientY: 20,
                preventDefault: vi.fn(),
            } as unknown as ReactMouseEvent<HTMLElement>);
        });

        act(() => {
            result.current.setManualRedactionHover(
                "first",
                "shared",
                true,
            );
        });

        expect(
            first.classList.contains(
                "highlight--redaction-hover",
            ),
        ).toBe(true);

        expect(
            second.classList.contains(
                "highlight--redaction-hover",
            ),
        ).toBe(true);

        act(() => {
            document.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Escape",
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(result.current.redactionRemoveMenu)
            .toBeNull();

        expect(document.activeElement).toBe(first);

        expect(
            first.classList.contains(
                "highlight--redaction-hover",
            ),
        ).toBe(false);

        expect(
            second.classList.contains(
                "highlight--redaction-hover",
            ),
        ).toBe(false);

        unmount();
        first.remove();
        second.remove();
    });
});
