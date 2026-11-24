// @vitest-environment jsdom

import {
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import {
    consumeAuthReturnPath,
    setAuthReturnPath,
} from "../app/lib/authReturnPath";

beforeEach(() => {
    window.localStorage.clear();

    window.history.replaceState(
        {},
        "",
        "/",
    );
});

describe("auth return path", () => {
    it.each([
        [
            "/upload",
            "/upload",
        ],
        [
            "/processing?documentId=document-123",
            "/processing?documentId=document-123",
        ],
        [
            "/review?documentId=document-123",
            "/review?documentId=document-123",
        ],
        [
            "/applying-redactions?documentId=document-123",
            "/applying-redactions?documentId=document-123",
        ],
        [
            "/export?documentId=document-123",
            "/export?documentId=document-123",
        ],
    ])(
        "preserves %s",
        (
            path,
            expected,
        ) => {
            setAuthReturnPath(path);

            expect(
                consumeAuthReturnPath(),
            ).toBe(expected);
        },
    );

    it("removes run IDs and other query parameters", () => {
        setAuthReturnPath(
            "/review?documentId=document-123&runId=old-run&other=value",
        );

        expect(
            consumeAuthReturnPath(),
        ).toBe(
            "/review?documentId=document-123",
        );
    });

    it("encodes the document ID safely", () => {
        setAuthReturnPath(
            "/review?documentId=document%2F123",
        );

        expect(
            consumeAuthReturnPath(),
        ).toBe(
            "/review?documentId=document%2F123",
        );
    });

    it("rejects external URLs", () => {
        setAuthReturnPath(
            "https://example.com/review?documentId=document-123",
        );

        expect(
            consumeAuthReturnPath(),
        ).toBeNull();
    });

    it("rejects unsupported routes", () => {
        setAuthReturnPath(
            "/access-denied",
        );

        expect(
            consumeAuthReturnPath(),
        ).toBeNull();
    });

    it("rejects document routes without a document ID", () => {
        setAuthReturnPath(
            "/review",
        );

        expect(
            consumeAuthReturnPath(),
        ).toBeNull();
    });

    it("can only be consumed once", () => {
        setAuthReturnPath(
            "/review?documentId=document-123",
        );

        expect(
            consumeAuthReturnPath(),
        ).toBe(
            "/review?documentId=document-123",
        );

        expect(
            consumeAuthReturnPath(),
        ).toBeNull();
    });
});