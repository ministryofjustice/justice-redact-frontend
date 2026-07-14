"use client";

import {
    type KeyboardEvent,
    type ReactNode,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";

type ModalProps = {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    closeOnBackdrop?: boolean;
};

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function Modal({
    isOpen,
    title,
    onClose,
    children,
    closeOnBackdrop = true,
}: ModalProps) {
    const [isMounted, setIsMounted] = useState(false);
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        previouslyFocusedElementRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        window.requestAnimationFrame(() => {
            closeButtonRef.current?.focus();
        });

        return () => {
            document.body.style.overflow = previousOverflow;
            previouslyFocusedElementRef.current?.focus();
        };
    }, [isOpen]);

    function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
        }

        if (event.key !== "Tab") return;

        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = Array.from(
            dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter(
            (element) =>
                !element.hasAttribute("disabled") &&
                element.getAttribute("aria-hidden") !== "true"
        );

        if (focusableElements.length === 0) {
            event.preventDefault();
            dialog.focus();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (
            event.shiftKey &&
            document.activeElement === firstElement
        ) {
            event.preventDefault();
            lastElement.focus();
        } else if (
            !event.shiftKey &&
            document.activeElement === lastElement
        ) {
            event.preventDefault();
            firstElement.focus();
        }
    }

    if (!isMounted || !isOpen) return null;

    return createPortal(
        <div
            className="jr-modal__backdrop"
            onMouseDown={(event) => {
                if (
                    closeOnBackdrop &&
                    event.target === event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <div
                ref={dialogRef}
                className="jr-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={handleDialogKeyDown}
            >
                <div className="jr-modal__header">
                    <button
                        ref={closeButtonRef}
                        type="button"
                        className="jr-modal__close"
                        aria-label={`Close ${title}`}
                        onClick={onClose}
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>

                <div className="jr-modal__content">
                    <h2
                        id={titleId}
                        className="govuk-heading-l"
                    >
                        {title}
                    </h2>

                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}