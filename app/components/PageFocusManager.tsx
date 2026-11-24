"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageFocusManager() {
    const pathname = usePathname();

    useEffect(() => {
        // Returning from Applying redactions has its own focus
        // and scroll behaviour at the end of the document.
        if (
            pathname === "/review" &&
            new URLSearchParams(window.location.search).get("returnTo") === "end"
        ) {
            return;
        }

        const main = document.getElementById("main-content");
        if (!main) return;

        let observer: MutationObserver | null = null;

        function focusPageContent(): boolean {
            if (!main) return false;

            // Respect focus already managed by the current page.
            if (main.contains(document.activeElement)) {
                return true;
            }

            const isVisible = (element: HTMLElement) =>
                element.getClientRects().length > 0;

            const errorSummary = Array.from(
                main.querySelectorAll<HTMLElement>(".govuk-error-summary"),
            ).find(isVisible);

            const heading = Array.from(
                main.querySelectorAll<HTMLHeadingElement>("h1"),
            ).find(isVisible);

            const target = errorSummary ?? heading;

            if (!target) return false;

            target.tabIndex = -1;
            target.focus({ preventScroll: false });

            return true;
        }

        const frame = requestAnimationFrame(() => {
            if (focusPageContent()) return;

            // Support pages that render their heading after data loads.
            observer = new MutationObserver(() => {
                if (focusPageContent()) {
                    observer?.disconnect();
                }
            });

            observer.observe(main, {
                childList: true,
                subtree: true,
            });
        });

        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
        };
    }, [pathname]);

    return null;
}
