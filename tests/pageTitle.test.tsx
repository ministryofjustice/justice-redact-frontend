// @vitest-environment jsdom

import {
    cleanup,
    render,
} from "@testing-library/react";
import {
    afterEach,
    describe,
    expect,
    it,
} from "vitest";

import PageTitle from "../app/components/PageTitle";

afterEach(() => {
    cleanup();
});

describe("PageTitle", () => {
    it("formats the browser title using the page heading and service name", () => {
        render(
            <PageTitle title="Page not found" />,
        );

        expect(document.title).toBe(
            "Page not found - Justice Redact",
        );
    });

    it("updates the browser title when the page heading changes", () => {
        const { rerender } = render(
            <PageTitle title="Your link was not recognised" />,
        );

        expect(document.title).toBe(
            "Your link was not recognised - Justice Redact",
        );

        rerender(
            <PageTitle title="Your link has expired" />,
        );

        expect(document.title).toBe(
            "Your link has expired - Justice Redact",
        );
    });

    it("front loads the browser title with Error when the page has an error", () => {
        render(
            <PageTitle
                title="Upload a file"
                hasError
            />,
        );

        expect(document.title).toBe(
            "Error: Upload a file - Justice Redact",
        );
    });

    it("removes the Error prefix when the error clears", () => {
        const { rerender } = render(
            <PageTitle
                title="Upload a file"
                hasError
            />,
        );

        expect(document.title).toBe(
            "Error: Upload a file - Justice Redact",
        );

        rerender(
            <PageTitle
                title="Upload a file"
                hasError={false}
            />,
        );

        expect(document.title).toBe(
            "Upload a file - Justice Redact",
        );
    });
});