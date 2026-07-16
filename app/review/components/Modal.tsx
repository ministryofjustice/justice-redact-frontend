"use client";

import {
    type KeyboardEvent,
    type ReactNode,
    type RefObject,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";

export type ModalVariant = "standard" | "content-dense";

type ModalProps = {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    variant?: ModalVariant;
    closeOnBackdrop?: boolean;
    initialFocusRef?: RefObject<HTMLElement | null>;
    contentClassName?: string;
    renderTitle?: boolean;
};

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function Modal({
    isOpen,
    title,
    onClose,
    children,
    variant = "standard",
    closeOnBackdrop = true,
    initialFocusRef,
    contentClassName,
    renderTitle = true,
}: ModalProps) {
    const [isMounted, setIsMounted] = useState(false);
    const titleId = useId();

    const backdropRef = useRef<HTMLDivElement>(null);
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

        const modalRoot = backdropRef.current;
        const backgroundElements = Array.from(document.body.children).filter(
            (element): element is HTMLElement =>
                element instanceof HTMLElement && element !== modalRoot
        );

        const previousBackgroundState = backgroundElements.map((element) => ({
            element,
            inert: element.inert,
            ariaHidden: element.getAttribute("aria-hidden"),
        }));

        backgroundElements.forEach((element) => {
            element.inert = true;
            element.setAttribute("aria-hidden", "true");
        });

        window.requestAnimationFrame(() => {
            const initialFocusElement = initialFocusRef?.current;

            if (initialFocusElement) {
                initialFocusElement.focus();
                return;
            }

            closeButtonRef.current?.focus();
        });

        return () => {
            document.body.style.overflow = previousOverflow;

            previousBackgroundState.forEach(
                ({ element, inert, ariaHidden }) => {
                    element.inert = inert;

                    if (ariaHidden === null) {
                        element.removeAttribute("aria-hidden");
                    } else {
                        element.setAttribute("aria-hidden", ariaHidden);
                    }
                }
            );

            previouslyFocusedElementRef.current?.focus();
        };
    }, [initialFocusRef, isOpen]);

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
            return;
        }

        if (
            !event.shiftKey &&
            document.activeElement === lastElement
        ) {
            event.preventDefault();
            firstElement.focus();
        }
    }

    if (!isMounted || !isOpen) return null;

    const modalClasses = [
        "jr-modal",
        `jr-modal--${variant}`,
    ].join(" ");

    const contentClasses = [
        "jr-modal__content",
        contentClassName,
    ]
        .filter(Boolean)
        .join(" ");

    return createPortal(
        <div
            ref={backdropRef}
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
                className={modalClasses}
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

                <div className={contentClasses}>
                    {renderTitle ? (
                        <h2
                            id={titleId}
                            className="govuk-heading-l jr-modal__title"
                        >
                            {title}
                        </h2>
                    ) : (
                        <span
                            id={titleId}
                            className="govuk-visually-hidden"
                        >
                            {title}
                        </span>
                    )}

                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}