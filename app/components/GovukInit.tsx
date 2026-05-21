"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function GovukInit() {
    const pathname = usePathname();

    useEffect(() => {
        const timeout = window.setTimeout(async () => {
            try {
                const govuk = await import("govuk-frontend/dist/govuk/all.mjs");

                govuk.initAll(document.body);
            } catch (error) {
                console.error("GOVUK initAll failed:", error);
            }
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [pathname]);

    return null;
}