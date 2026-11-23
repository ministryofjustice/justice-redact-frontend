// @vitest-environment jsdom

import {
    act,
    renderHook,
} from "@testing-library/react";

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    useApplyRedactions,
} from "../features/documents/review/useApplyRedactions";

import type {
    UseApplyRedactionsOptions,
} from "../features/documents/review/useApplyRedactions";

const mocks = vi.hoisted(() => ({
    fetchJson: vi.fn(),
    push: vi.fn(),
    consumeFailure: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: mocks.push,
    }),
}));

vi.mock("../app/lib/api", () => ({
    fetchJson: mocks.fetchJson,
}));

vi.mock("../app/lib/applyRedactionsFailure", () => ({
    consumeApplyRedactionsFailure:
        mocks.consumeFailure,
}));

function makeOptions(
    overrides: Partial<UseApplyRedactionsOptions> = {},
): UseApplyRedactionsOptions {
    return {
        documentId: "doc-1",
        documentData: {
            documentId: "doc-1",
        },
        manualSelections: [],
        pageStatuses: {
            1: "deleted",
        },
        hasDecisionConflict: false,
        clearDecisionSaveError: vi.fn(),
        saveBeforeApply: vi.fn().mockResolvedValue(7),
        ...overrides,
    };
}

beforeEach(() => {
    vi.resetAllMocks();

    vi.stubGlobal("scrollTo", vi.fn());

    mocks.consumeFailure.mockReturnValue(false);

    mocks.fetchJson.mockResolvedValue({
        documentId: "doc-1",
        runId: "run-1",
        status: "PROCESSING",
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("useApplyRedactions", () => {
    it("saves decisions before applying and navigates with the backend run ID", async () => {
        const options = makeOptions();

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(options.saveBeforeApply)
            .toHaveBeenCalledTimes(1);

        expect(options.saveBeforeApply)
            .toHaveBeenCalledWith(
                [],
                { 1: "deleted" },
            );

        expect(mocks.fetchJson)
            .toHaveBeenCalledTimes(1);

        expect(
            vi.mocked(options.saveBeforeApply)
                .mock.invocationCallOrder[0],
        ).toBeLessThan(
            mocks.fetchJson.mock.invocationCallOrder[0],
        );

        const [url, requestOptions] =
            mocks.fetchJson.mock.calls[0] as [
                string,
                RequestInit,
            ];

        expect(url).toContain(
            "/documents/doc-1/apply-redactions",
        );

        expect(requestOptions.method).toBe("POST");

        expect(
            JSON.parse(String(requestOptions.body)),
        ).toEqual({
            documentId: "doc-1",
            decisions: [
                {
                    kind: "page",
                    pageNumber: 1,
                    action: "delete",
                    source: "manual",
                },
            ],
            expectedRevision: 7,
        });

        expect(mocks.push).toHaveBeenCalledWith(
            "/applying-redactions?documentId=doc-1&runId=run-1",
        );

        expect(result.current.isApplyingRedactions)
            .toBe(true);
    });

    it("shows validation without submitting an empty decision set", async () => {
        const options = makeOptions({
            pageStatuses: {},
        });

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(result.current.showNoChangesValidation)
            .toBe(true);

        expect(result.current.validationFocusRequest)
            .toBe(1);

        expect(result.current.showApplyRedactionsFailure)
            .toBe(false);

        expect(options.saveBeforeApply)
            .not.toHaveBeenCalled();

        expect(mocks.fetchJson)
            .not.toHaveBeenCalled();

        expect(mocks.push)
            .not.toHaveBeenCalled();

        expect(result.current.isApplyingRedactions)
            .toBe(false);

        expect(window.scrollTo)
            .toHaveBeenCalled();
    });


    it("requests focus again after repeated empty Apply attempts", async () => {
        const options = makeOptions({
            pageStatuses: {},
        });

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(result.current.validationFocusRequest)
            .toBe(1);

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(result.current.validationFocusRequest)
            .toBe(2);

        expect(result.current.showNoChangesValidation)
            .toBe(true);

        expect(options.saveBeforeApply)
            .not.toHaveBeenCalled();

        expect(mocks.fetchJson)
            .not.toHaveBeenCalled();
    });

    it.each(["exempted", "deleted"] as const)(
        "allows a single %s page to be applied",
        async (status) => {
            const options = makeOptions({
                pageStatuses: { 1: status },
            });

            const { result } = renderHook(() =>
                useApplyRedactions(options),
            );

            await act(async () => {
                await result.current.handleApplyRedactions();
            });

            expect(options.saveBeforeApply)
                .toHaveBeenCalledTimes(1);

            expect(options.saveBeforeApply)
                .toHaveBeenCalledWith([], { 1: status });

            expect(mocks.fetchJson)
                .toHaveBeenCalledTimes(1);

            const request = JSON.parse(
                mocks.fetchJson.mock.calls[0][1].body,
            );

            expect(request.decisions).toEqual([
                {
                    kind: "page",
                    pageNumber: 1,
                    action: status === "exempted" ? "exempt" : "delete",
                    source: "manual",
                },
            ]);

            expect(result.current.showNoChangesValidation)
                .toBe(false);
        },
    );

    it("clears validation when a vetter adds a redaction and then applies", async () => {
        const options = makeOptions({
            pageStatuses: {},
        });

        const { result, rerender } = renderHook(
            (props: UseApplyRedactionsOptions) =>
                useApplyRedactions(props),
            { initialProps: options },
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(result.current.showNoChangesValidation)
            .toBe(true);

        const selection = {
            documentId: "doc-1",
            kind: "image",
            pageNumber: 1,
            imageId: "image-1",
        } as UseApplyRedactionsOptions["manualSelections"][number];

        rerender({
            ...options,
            manualSelections: [selection],
        });

        expect(result.current.showNoChangesValidation)
            .toBe(false);

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(options.saveBeforeApply)
            .toHaveBeenCalledWith([selection], {});

        expect(mocks.fetchJson)
            .toHaveBeenCalledTimes(1);

        expect(mocks.push)
            .toHaveBeenCalledTimes(1);
    });

    it("does not count redactions belonging to another document", async () => {
        const options = makeOptions({
            pageStatuses: {},
            manualSelections: [{
                documentId: "another-document",
                kind: "image",
                pageNumber: 1,
                imageId: "image-1",
            }] as UseApplyRedactionsOptions["manualSelections"],
        });

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(result.current.showNoChangesValidation)
            .toBe(true);

        expect(options.saveBeforeApply)
            .not.toHaveBeenCalled();

        expect(mocks.fetchJson)
            .not.toHaveBeenCalled();
    });

    it("does not submit without document data", async () => {
        const options = makeOptions({
            documentData: null,
        });

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(options.saveBeforeApply)
            .not.toHaveBeenCalled();

        expect(mocks.fetchJson)
            .not.toHaveBeenCalled();
    });

    it("blocks Apply when persisted decisions have a conflict", async () => {
        const options = makeOptions({
            hasDecisionConflict: true,
        });

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(result.current.applyRedactionsError)
            .toBe(
                "Refresh the page to load the latest saved decisions before applying redactions.",
            );

        expect(options.saveBeforeApply)
            .not.toHaveBeenCalled();

        expect(mocks.fetchJson)
            .not.toHaveBeenCalled();

        expect(result.current.isApplyingRedactions)
            .toBe(false);
    });

    it("does not call Apply when saving decisions fails", async () => {
        const options = makeOptions({
            saveBeforeApply: vi.fn().mockRejectedValue(
                new Error("Save failed"),
            ),
        });

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(mocks.fetchJson)
            .not.toHaveBeenCalled();

        expect(mocks.push)
            .not.toHaveBeenCalled();

        expect(result.current.showApplyRedactionsFailure)
            .toBe(true);

        expect(result.current.isApplyingRedactions)
            .toBe(false);

        expect(options.clearDecisionSaveError)
            .toHaveBeenCalled();

        expect(window.scrollTo)
            .toHaveBeenCalled();
    });

    it("shows the existing failure alert when the Apply API fails", async () => {
        mocks.fetchJson.mockRejectedValue(
            new Error("Apply failed"),
        );

        const options = makeOptions();

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(options.saveBeforeApply)
            .toHaveBeenCalledTimes(1);

        expect(mocks.push)
            .not.toHaveBeenCalled();

        expect(result.current.showApplyRedactionsFailure)
            .toBe(true);

        expect(result.current.isApplyingRedactions)
            .toBe(false);

        expect(options.clearDecisionSaveError)
            .toHaveBeenCalled();
    });

    it("restores a failure returned from the applying-redactions page", () => {
        mocks.consumeFailure.mockReturnValue(true);

        const { result } = renderHook(() =>
            useApplyRedactions(makeOptions()),
        );

        expect(mocks.consumeFailure)
            .toHaveBeenCalledWith("doc-1");

        expect(result.current.showApplyRedactionsFailure)
            .toBe(true);

        expect(window.scrollTo)
            .toHaveBeenCalled();
    });

    it("prevents duplicate Apply submissions during saving and navigation", async () => {
        let resolveSave:
            | ((revision: number) => void)
            | undefined;

        const pendingSave = new Promise<number>((resolve) => {
            resolveSave = resolve;
        });

        const saveBeforeApply = vi.fn()
            .mockReturnValue(pendingSave);

        const options = makeOptions({
            saveBeforeApply,
        });

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        const attempts: Promise<void>[] = [];

        act(() => {
            attempts.push(
                result.current.handleApplyRedactions(),
            );

            attempts.push(
                result.current.handleApplyRedactions(),
            );
        });

        expect(result.current.isApplyingRedactions)
            .toBe(true);

        await act(async () => {
            resolveSave?.(7);
            await Promise.all(attempts);
        });

        expect(saveBeforeApply)
            .toHaveBeenCalledTimes(1);

        expect(mocks.fetchJson)
            .toHaveBeenCalledTimes(1);

        expect(mocks.push)
            .toHaveBeenCalledTimes(1);

        // Navigation has been requested, but the hook
        // remains mounted in this test. Applying again
        // must not start a second processing run.
        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(saveBeforeApply)
            .toHaveBeenCalledTimes(1);

        expect(mocks.fetchJson)
            .toHaveBeenCalledTimes(1);
    });

    it("allows retrying after an Apply submission fails", async () => {
        const saveBeforeApply = vi.fn()
            .mockRejectedValueOnce(
                new Error("Temporary save failure"),
            )
            .mockResolvedValueOnce(8);

        const options = makeOptions({
            saveBeforeApply,
        });

        const { result } = renderHook(() =>
            useApplyRedactions(options),
        );

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(result.current.showApplyRedactionsFailure)
            .toBe(true);

        expect(result.current.isApplyingRedactions)
            .toBe(false);

        await act(async () => {
            await result.current.handleApplyRedactions();
        });

        expect(saveBeforeApply)
            .toHaveBeenCalledTimes(2);

        expect(mocks.fetchJson)
            .toHaveBeenCalledTimes(1);

        expect(mocks.push)
            .toHaveBeenCalledTimes(1);

        expect(result.current.showApplyRedactionsFailure)
            .toBe(false);
    });

});
