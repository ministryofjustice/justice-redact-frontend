"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import type {
    Dispatch,
    MouseEvent as ReactMouseEvent,
    SetStateAction,
} from "react";

import type {
    ManualDecision,
} from "../../../app/review/types";

type RedactionTarget = {
    manualId: string;
    redactionGroupId: string | null;
};

type RedactionRemoveMenu = RedactionTarget & {
    x: number;
    y: number;
};

type UseRedactionInteractionsArgs = {
    isRedactMode: boolean;
    setManualSelections: Dispatch<
        SetStateAction<ManualDecision[]>
    >;
};

function getRedactionTarget(
    target: EventTarget | null,
): RedactionTarget | null {
    if (!(target instanceof Element)) {
        return null;
    }

    const element =
        target.closest<HTMLElement>("[data-manual-id]");

    const manualId = element?.dataset.manualId;

    if (!element || !manualId) {
        return null;
    }

    return {
        manualId,
        redactionGroupId:
            element.dataset.redactionGroupId ?? null,
    };
}

function isSameRedactionTarget(
    left: RedactionTarget | null,
    right: RedactionTarget | null,
): boolean {
    if (!left || !right) {
        return false;
    }

    if (
        left.redactionGroupId &&
        right.redactionGroupId
    ) {
        return (
            left.redactionGroupId ===
            right.redactionGroupId
        );
    }

    return left.manualId === right.manualId;
}

function setManualRedactionHover(
    manualId: string,
    redactionGroupId: string | null,
    isHovered: boolean,
): void {
    document
        .querySelectorAll<HTMLElement>("[data-manual-id]")
        .forEach((element) => {
            const matches =
                redactionGroupId !== null
                    ? element.dataset.redactionGroupId ===
                    redactionGroupId
                    : element.dataset.manualId === manualId;

            if (matches) {
                element.classList.toggle(
                    "highlight--redaction-hover",
                    isHovered,
                );
            }
        });
}

export function useRedactionInteractions({
    isRedactMode,
    setManualSelections,
}: UseRedactionInteractionsArgs) {
    const [
        redactionRemoveMenu,
        setRedactionRemoveMenu,
    ] = useState<RedactionRemoveMenu | null>(null);

    const redactionRemoveTriggerRef =
        useRef<HTMLElement | null>(null);

    const redactionRemoveMenuRef =
        useRef<HTMLButtonElement | null>(null);

    function removeManualSelection(
        manualId: string,
        redactionGroupId: string | null,
    ): void {
        setManualSelections((previous) =>
            previous.filter((selection) => {
                if (redactionGroupId) {
                    if (selection.kind === "image") {
                        return true;
                    }

                    return (
                        selection.redactionGroupId !==
                        redactionGroupId
                    );
                }

                return selection.id !== manualId;
            }),
        );
    }

    function closeRedactionRemoveMenu(
        restoreFocus = false,
    ): void {
        if (redactionRemoveMenu) {
            setManualRedactionHover(
                redactionRemoveMenu.manualId,
                redactionRemoveMenu.redactionGroupId,
                false,
            );
        }

        setRedactionRemoveMenu(null);

        if (restoreFocus) {
            requestAnimationFrame(() => {
                redactionRemoveTriggerRef.current?.focus();
            });
        }
    }

    useEffect(() => {
        if (!redactionRemoveMenu) {
            return;
        }

        const {
            manualId,
            redactionGroupId,
        } = redactionRemoveMenu;

        function dismissMenu(restoreFocus = false) {
            setManualRedactionHover(
                manualId,
                redactionGroupId,
                false,
            );

            setRedactionRemoveMenu(null);

            if (restoreFocus) {
                requestAnimationFrame(() => {
                    redactionRemoveTriggerRef.current?.focus();
                });
            }
        }

        function handleMouseDown(
            event: globalThis.MouseEvent,
        ) {
            if (!(event.target instanceof Node)) {
                return;
            }

            if (
                redactionRemoveMenuRef.current?.contains(
                    event.target,
                )
            ) {
                return;
            }

            dismissMenu();
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key !== "Escape") {
                return;
            }

            event.preventDefault();
            dismissMenu(true);
        }

        function handleViewportChange() {
            dismissMenu();
        }

        document.addEventListener(
            "mousedown",
            handleMouseDown,
        );
        document.addEventListener(
            "keydown",
            handleKeyDown,
        );

        window.addEventListener(
            "scroll",
            handleViewportChange,
            true,
        );
        window.addEventListener(
            "resize",
            handleViewportChange,
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleMouseDown,
            );
            document.removeEventListener(
                "keydown",
                handleKeyDown,
            );

            window.removeEventListener(
                "scroll",
                handleViewportChange,
                true,
            );
            window.removeEventListener(
                "resize",
                handleViewportChange,
            );
        };
    }, [redactionRemoveMenu]);

    function handleRedactionMouseOver(
        event: ReactMouseEvent<HTMLElement>,
    ): void {
        if (!isRedactMode) {
            return;
        }

        const target =
            getRedactionTarget(event.target);

        if (!target) {
            return;
        }

        const related =
            getRedactionTarget(event.relatedTarget);

        if (isSameRedactionTarget(target, related)) {
            return;
        }

        setManualRedactionHover(
            target.manualId,
            target.redactionGroupId,
            true,
        );
    }

    function handleRedactionMouseOut(
        event: ReactMouseEvent<HTMLElement>,
    ): void {
        if (!isRedactMode) {
            return;
        }

        const target =
            getRedactionTarget(event.target);

        if (!target) {
            return;
        }

        const related =
            getRedactionTarget(event.relatedTarget);

        if (isSameRedactionTarget(target, related)) {
            return;
        }

        setManualRedactionHover(
            target.manualId,
            target.redactionGroupId,
            false,
        );
    }

    function handleRedactionContextMenu(
        event: ReactMouseEvent<HTMLElement>,
    ): void {
        if (!isRedactMode) {
            return;
        }

        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const element =
            target.closest<HTMLElement>("[data-manual-id]");

        const redactionTarget =
            getRedactionTarget(target);

        if (!element || !redactionTarget) {
            return;
        }

        event.preventDefault();

        redactionRemoveTriggerRef.current = element;

        setRedactionRemoveMenu({
            manualId: redactionTarget.manualId,
            redactionGroupId:
                redactionTarget.redactionGroupId,
            x: event.clientX,
            y: event.clientY,
        });
    }

    return {
        redactionRemoveMenu,
        redactionRemoveMenuRef,
        setManualRedactionHover,
        removeManualSelection,
        closeRedactionRemoveMenu,
        handleRedactionMouseOver,
        handleRedactionMouseOut,
        handleRedactionContextMenu,
    };
}
