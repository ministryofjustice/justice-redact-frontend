"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function GovukInit() {
    const pathname = usePathname();

    useEffect(() => {
        async function init() {
            try {
                const [govuk, moj] = await Promise.all([
                    import("govuk-frontend/dist/govuk/all.mjs"),
                    import("@ministryofjustice/frontend/moj/all.mjs"),
                ]);

                govuk.initAll(document.body);
                moj.initAll(document.body);
            } catch (error) {
                console.error("Initialisation failed:", error);
            }
        }

        init();
    }, [pathname]);

    return null;
}