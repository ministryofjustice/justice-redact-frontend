"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function GovukInit() {
    const pathname = usePathname();

    useEffect(() => {
        async function init() {
            try {
                const govuk = await import(
                    "govuk-frontend/dist/govuk/all.mjs"
                );

                govuk.initAll(document.body);
            } catch (error) {
                console.error("GOV.UK initialisation failed:", error);
            }
        }

        init();
    }, [pathname]);

    return null;
}