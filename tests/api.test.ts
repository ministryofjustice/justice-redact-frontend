// @vitest-environment jsdom

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    ApiError,
    fetchJson,
} from "../app/lib/api";

import {
    consumeAuthReturnPath,
} from "../app/lib/authReturnPath";

beforeEach(() => {
    vi.restoreAllMocks();

    window.localStorage.clear();

    window.history.replaceState(
        {},
        "",
        "/review?documentId=document-123",
    );
});

describe("fetchJson authentication handling", () => {
    it("preserves the current protected page when an API request returns 401", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        detail:
                            "Authentication required.",
                    }),
                    {
                        status: 401,
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                    },
                ),
            ),
        );

        await expect(
            fetchJson(
                "http://localhost:8000/api/test",
            ),
        ).rejects.toBeInstanceOf(
            ApiError,
        );

        expect(
            consumeAuthReturnPath(),
        ).toBe(
            "/review?documentId=document-123",
        );
    });

    it("does not preserve the current page when unauthorized redirects are disabled", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        detail:
                            "Authentication required.",
                    }),
                    {
                        status: 401,
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                    },
                ),
            ),
        );

        await expect(
            fetchJson(
                "http://localhost:8000/auth/me",
                {
                    redirectOnUnauthorized:
                        false,
                },
            ),
        ).rejects.toBeInstanceOf(
            ApiError,
        );

        expect(
            consumeAuthReturnPath(),
        ).toBeNull();
    });
});