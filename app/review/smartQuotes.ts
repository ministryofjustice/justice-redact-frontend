/**
 * Convert straight quotation marks and apostrophes into
 * typographic quotes for presentation only.
 *
 * Each replacement is exactly one UTF-16 code unit.
 * This preserves offsets used by redaction selections.
 *
 * Never use this function to modify extracted PDF data,
 * search indexes or persisted redaction decisions.
 */
export function toSmartQuotes(text: string): string {
    const isWordCharacter = (character: string) =>
        /[\p{L}\p{N}]/u.test(character);

    return text.replace(/['"]/g, (quote, offset: number) => {
        const previous = text[offset - 1] ?? "";
        const next = text[offset + 1] ?? "";

        if (quote === "'") {
            // Contractions and possessives:
            // don't, John's, James'
            if (isWordCharacter(previous)) {
                return "’";
            }

            // Abbreviated years: '90s
            if (/\d/u.test(next)) {
                return "’";
            }
        }

       // A quote is normally opening when preceded by
        // whitespace, the start of a string or an
        // opening punctuation mark.
        const isOpening =
            (offset === 0 ||
                /[\s([{—–]/u.test(previous)) &&
            next !== "" &&
            !/\s/u.test(next);

        if (quote === '"') {
            return isOpening ? "“" : "”";
        }

        return isOpening ? "‘" : "’";
    });
}
