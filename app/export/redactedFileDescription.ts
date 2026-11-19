export type RedactedFileDescriptionOptions = {
    hasContentRedactions?: boolean;
    hasExemptPages: boolean;
    hasDeletedPages: boolean;
};

export const LEGACY_REDACTED_FILE_DESCRIPTION =
    "Fully sanitised with redactions blacked out and no AI suggestions highlighted.";

/**
 * Describes the completed redacted PDF based on its operations.
 * Older export responses preserve the existing description until
 * the backend provides authoritative content-redaction metadata.
 */
export function getRedactedFileDescription({
    hasContentRedactions,
    hasExemptPages,
    hasDeletedPages,
}: RedactedFileDescriptionOptions): string {
    if (hasContentRedactions === undefined) {
        return LEGACY_REDACTED_FILE_DESCRIPTION;
    }

    const operations: string[] = [];

    if (hasContentRedactions) {
        operations.push("redactions blacked out");
    }

    if (hasExemptPages && hasDeletedPages) {
        operations.push("exempt and deleted pages removed");
    } else if (hasExemptPages) {
        operations.push("exempt pages removed");
    } else if (hasDeletedPages) {
        operations.push("deleted pages removed");
    }

    operations.push("no AI suggestions highlighted");

    const finalOperation = operations.pop();

    const description = operations.length
        ? `${operations.join(", ")} and ${finalOperation}`
        : finalOperation;

    return `Fully sanitised with ${description}.`;
}

export function shouldShowExemptedRow(
    exemptExportUrl: string | null | undefined,
    exemptPageCount: number | undefined
): boolean {
    return Boolean(exemptExportUrl) &&
        (exemptPageCount === undefined || exemptPageCount > 0);
}
