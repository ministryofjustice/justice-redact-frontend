"use client";

import { useEffect } from "react";

type PageTitleProps = {
    title: string;
    hasError?: boolean;
};

export function usePageTitle(
    title: string,
    hasError = false,
    enabled = true,
) {
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const prefix = hasError ? "Error: " : "";

        document.title = `${prefix}${title} - Justice Redact`;
    }, [enabled, hasError, title]);
}

export default function PageTitle({
    title,
    hasError = false,
}: PageTitleProps) {
    usePageTitle(title, hasError);

    return null;
}