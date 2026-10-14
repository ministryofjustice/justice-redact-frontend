"use client";

import { useEffect } from "react";

type PageTitleProps = {
    title: string;
    hasError?: boolean;
};

export function usePageTitle(
    title: string,
    hasError = false,
) {
    useEffect(() => {
        const prefix = hasError ? "Error: " : "";

        document.title = `${prefix}${title} - Justice Redact`;
    }, [hasError, title]);
}

export default function PageTitle({
    title,
    hasError = false,
}: PageTitleProps) {
    usePageTitle(title, hasError);

    return null;
}