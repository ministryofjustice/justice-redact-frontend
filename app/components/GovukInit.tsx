"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function GovukInit() {
    const pathname = usePathname();

    useEffect(() => {
        const timeout = window.setTimeout(async () => {
            try {
                const [govuk, moj] = await Promise.all([
                    import("govuk-frontend/dist/govuk/all.mjs"),
                    import("@ministryofjustice/frontend/moj/all.mjs"),
                ]);

                govuk.initAll(document.body);
                moj.initAll(document.body);
            } catch (error) {
                console.error("Design system initialisation failed:", error);
            }
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [pathname]);

    return null;
}