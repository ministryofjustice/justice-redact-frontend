"use client";

import { useEffect } from "react";

type PageTitleProps = {
    title: string;
    hasError?: boolean;
};

export default function PageTitle({
    title,
    hasError = false,
}: PageTitleProps) {
    useEffect(() => {
        const prefix = hasError ? "Error: " : "";

        document.title = `${prefix}${title} - Justice Redact`;
    }, [hasError, title]);

    return null;
}