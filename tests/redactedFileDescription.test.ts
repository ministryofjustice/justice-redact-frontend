import { describe, expect, it } from "vitest";

import {
    getRedactedFileDescription,
    LEGACY_REDACTED_FILE_DESCRIPTION,
    shouldShowExemptedRow,
} from "../app/export/redactedFileDescription";

describe("Redacted file description", () => {
    const scenarios = [
        [true, true, true,
            "Fully sanitised with redactions blacked out, exempt and deleted pages removed and no AI suggestions highlighted."],
        [true, true, false,
            "Fully sanitised with redactions blacked out, exempt pages removed and no AI suggestions highlighted."],
        [true, false, true,
            "Fully sanitised with redactions blacked out, deleted pages removed and no AI suggestions highlighted."],
        [true, false, false,
            "Fully sanitised with redactions blacked out and no AI suggestions highlighted."],
        [false, true, false,
            "Fully sanitised with exempt pages removed and no AI suggestions highlighted."],
        [false, false, true,
            "Fully sanitised with deleted pages removed and no AI suggestions highlighted."],
        [false, true, true,
            "Fully sanitised with exempt and deleted pages removed and no AI suggestions highlighted."],
        [false, false, false,
            "Fully sanitised with no AI suggestions highlighted."],
    ] as const;

    it.each(scenarios)(
        "generates correct copy for redactions=%s exempt=%s deleted=%s",
        (redactions, exempt, deleted, expected) => {
            expect(getRedactedFileDescription({
                hasContentRedactions: redactions,
                hasExemptPages: exempt,
                hasDeletedPages: deleted,
            })).toBe(expected);
        }
    );

    it("preserves existing copy when the API flag is unavailable", () => {
        expect(getRedactedFileDescription({
            hasExemptPages: true,
            hasDeletedPages: true,
        })).toBe(LEGACY_REDACTED_FILE_DESCRIPTION);
    });
});

describe("Exempted export row", () => {
    it("shows when an exempt PDF and positive page count exist", () => {
        expect(shouldShowExemptedRow("/exempt.pdf", 2)).toBe(true);
    });

    it("hides when no pages are exempted", () => {
        expect(shouldShowExemptedRow("/exempt.pdf", 0)).toBe(false);
    });

    it("hides when no exempt PDF exists", () => {
        expect(shouldShowExemptedRow(null, 2)).toBe(false);
    });

    it("supports legacy responses without page counts", () => {
        expect(shouldShowExemptedRow("/exempt.pdf", undefined)).toBe(true);
    });
});
