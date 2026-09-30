"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export async function initialiseGovuk(
    scope: HTMLElement = document.body,
) {
    try {
        const govuk = await import(
            "govuk-frontend/dist/govuk/all.mjs"
        );

        govuk.initAll({
            scope,
        });
    } catch (error) {
        console.error(
            "GOV.UK initialisation failed:",
            error,
        );
    }
}

export default function GovukInit() {
    const pathname = usePathname();

    useEffect(() => {
        void initialiseGovuk(document.body);
    }, [pathname]);

    return null;
}