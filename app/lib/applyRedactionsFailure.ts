const APPLY_REDACTIONS_FAILURE_STORAGE_ITEM =
    "justice-redact-apply-redactions-failure";

export function setApplyRedactionsFailure(
    documentId: string,
): void {
    if (typeof window === "undefined") {
        return;
    }

    window.sessionStorage.setItem(
        APPLY_REDACTIONS_FAILURE_STORAGE_ITEM,
        documentId,
    );
}

export function consumeApplyRedactionsFailure(
    documentId: string,
): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    const failedDocumentId =
        window.sessionStorage.getItem(
            APPLY_REDACTIONS_FAILURE_STORAGE_ITEM,
        );

    if (failedDocumentId !== documentId) {
        return false;
    }

    window.sessionStorage.removeItem(
        APPLY_REDACTIONS_FAILURE_STORAGE_ITEM,
    );

    return true;
}