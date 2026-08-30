"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ReviewMode } from "../types";

type ModeToggleGroupProps = {
    value: ReviewMode;
    onChange: (mode: ReviewMode) => void;
};

const modes: Array<{
    value: ReviewMode;
    label: string;
    statusLabel: string;
    statusClass: string;
}> = [
        {
            value: "select",
            label: "Select",
            statusLabel: "Select mode",
            statusClass: "govuk-tag--purple",
        },
        {
            value: "redact",
            label: "Redact",
            statusLabel: "Redact mode",
            statusClass: "govuk-tag--orange",
        },
        {
            value: "preview",
            label: "Preview",
            statusLabel: "Preview mode",
            statusClass: "govuk-tag--green",
        },
    ];

export default function ModeToggleGroup({
    value,
    onChange,
}: ModeToggleGroupProps) {
    const [isOpen, setIsOpen] = useState(false);

    const menuId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const selectedMode =
        modes.find((mode) => mode.value === value) ?? modes[0];

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

    function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
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

    function handleMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
        if (event.key === "Escape") {
            event.preventDefault();
            setIsOpen(false);
            buttonRef.current?.focus();
        }
    }

    function handleModeChange(mode: ReviewMode) {
        onChange(mode);
        setIsOpen(false);

        requestAnimationFrame(() => {
            buttonRef.current?.focus();
        });
    }

    return (
        <div
            ref={containerRef}
            className="jr-mode-status-group"
        >
            <div className="moj-button-menu jr-mode-menu">
                <button
                    ref={buttonRef}
                    type="button"
                    className="govuk-button moj-button-menu__toggle-button govuk-button--secondary"
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                    onKeyDown={handleButtonKeyDown}
                    onClick={() => setIsOpen((open) => !open)}
                >
                    <span>
                        Mode
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
                    className="moj-button-menu__wrapper moj-button-menu__wrapper--right"
                    role="menu"
                    hidden={!isOpen}
                    onKeyDown={handleMenuKeyDown}
                >
                    {modes.map((mode, index) => {
                        const isActive = mode.value === value;

                        return (
                            <li key={mode.value}>
                                <button
                                    type="button"
                                    className={[
                                        "moj-button-menu__item",
                                        "jr-mode-menu__item",
                                        isActive ? "jr-mode-menu__item--active" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    role="menuitem"
                                    aria-pressed={isActive}
                                    onClick={() => handleModeChange(mode.value)}
                                    ref={(element) => {
                                        menuItemRefs.current[index] = element;
                                    }}
                                >
                                    {mode.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <strong
                className={`govuk-tag jr-mode-status-tag ${selectedMode.statusClass}`}
            >
                <span className="jr-mode-status-tag__text">
                    {selectedMode.statusLabel}
                </span>
            </strong>
        </div>
    );
}