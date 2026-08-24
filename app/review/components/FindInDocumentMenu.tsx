"use client";

import { useEffect, useId, useRef, useState } from "react";

type FindInDocumentMenuProps = {
    onFindAndRedact: () => void;
    onFindAndPartiallyRedact: () => void;
    onFindAndDisclose: () => void;
};

export default function FindInDocumentMenu({
    onFindAndRedact,
    onFindAndPartiallyRedact,
    onFindAndDisclose,
}: FindInDocumentMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    function handleMenuKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
        if (event.key === "Escape") {
            event.preventDefault();
            setIsOpen(false);
            buttonRef.current?.focus();
        }
    }

    function handleButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                setIsOpen(true);

                requestAnimationFrame(() => {
                    menuItemRefs.current[0]?.focus();
                });
                break;

            case "ArrowUp":
                event.preventDefault();
                setIsOpen(true);

                requestAnimationFrame(() => {
                    menuItemRefs.current.at(-1)?.focus();
                });
                break;

            case "Escape":
                setIsOpen(false);
                break;
        }
    }

    return (
        <div
            ref={containerRef}
            className="moj-button-menu"
        >
            <button
                type="button"
                className="govuk-button moj-button-menu__toggle-button govuk-button--secondary"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls={menuId}
                ref={buttonRef}
                onKeyDown={handleButtonKeyDown}
                onClick={() => setIsOpen((open) => !open)}
            >
                <span>
                    Find in document
                    <svg
                        width="11"
                        height="5"
                        viewBox="0 0 11 5"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path
                            d="M5.5 0L11 5L0 5L5.5 0Z"
                            fill="currentColor"
                        />
                    </svg>
                </span>
            </button>

            <ul
                id={menuId}
                className="moj-button-menu__wrapper"
                role="menu"
                hidden={!isOpen}
                onKeyDown={handleMenuKeyDown}
            >
                <li>
                    <button
                        type="button"
                        className="moj-button-menu__item"
                        onClick={() => {
                            setIsOpen(false);
                            onFindAndRedact();
                        }}
                        role="menuitem"
                        ref={(element) => {
                            menuItemRefs.current[0] = element;
                        }}
                    >
                        Find and redact
                    </button>
                </li>

                <li>
                    <button
                        type="button"
                        className="moj-button-menu__item"
                        onClick={() => {
                            setIsOpen(false);
                            onFindAndPartiallyRedact();
                        }}
                        role="menuitem"
                        ref={(element) => {
                            menuItemRefs.current[1] = element;
                        }}
                    >
                        Find and partially redact
                    </button>
                </li>

                <li>
                    <button
                        type="button"
                        className="moj-button-menu__item"
                        onClick={() => {
                            setIsOpen(false);
                            onFindAndDisclose();
                        }}
                        role="menuitem"
                        ref={(element) => {
                            menuItemRefs.current[2] = element;
                        }}
                    >
                        Find and disclose
                    </button>
                </li>
            </ul>
        </div>
    );
}