"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type BackLinkProps = {
    href: string;
    children?: ReactNode;
    onBack?: () => void | Promise<void>;
    disabled?: boolean;
};

export default function BackLink({
    href,
    children = "Back",
    onBack,
    disabled = false,
}: BackLinkProps) {
    return (
        <Link
            href={href}
            className="govuk-back-link"
            aria-disabled={disabled || undefined}
            onClick={(event) => {
                if (disabled) {
                    event.preventDefault();
                    return;
                }

                if (onBack) {
                    event.preventDefault();
                    void onBack();
                }
            }}
        >
            {children}
        </Link>
    );
}