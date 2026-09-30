const AUTH_RETURN_PATH_KEY =
    "justice-redact-auth-return-path";

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
        AUTH_RETURN_PATH_KEY,
        safePath,
    );
}

export function consumeAuthReturnPath():
    string | null {
    const storedPath =
        window.localStorage.getItem(
            AUTH_RETURN_PATH_KEY,
        );

    window.localStorage.removeItem(
        AUTH_RETURN_PATH_KEY,
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