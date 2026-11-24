const RETURN_PATH_STORAGE_ITEM =
    "justice-redact-return-path";

export function setAuthReturnPath(
    path: string,
): void {
    const safePath = normaliseAuthReturnPath(
        path,
    );

    if (!safePath) {
        return;
    }

    window.localStorage.setItem(
        RETURN_PATH_STORAGE_ITEM,
        safePath,
    );
}

export function consumeAuthReturnPath():
    string | null {
    const storedPath =
        window.localStorage.getItem(
            RETURN_PATH_STORAGE_ITEM,
        );

    window.localStorage.removeItem(
        RETURN_PATH_STORAGE_ITEM,
    );

    if (!storedPath) {
        return null;
    }

    return normaliseAuthReturnPath(
        storedPath,
    );
}

function normaliseAuthReturnPath(
    path: string,
): string | null {
    try {
        const url = new URL(
            path,
            window.location.origin,
        );

        if (
            url.origin !==
            window.location.origin
        ) {
            return null;
        }

        if (url.pathname === "/upload") {
            return "/upload";
        }

        const documentRoutes = new Set([
            "/processing",
            "/review",
            "/applying-redactions",
            "/export",
        ]);

        if (
            !documentRoutes.has(
                url.pathname,
            )
        ) {
            return null;
        }

        const documentId =
            url.searchParams.get(
                "documentId",
            );

        if (!documentId) {
            return null;
        }

        return (
            `${url.pathname}?documentId=` +
            encodeURIComponent(documentId)
        );
    } catch {
        return null;
    }
}