import { describe, expect, it } from "vitest";
import { buildApplyRedactionsRequest } from "../app/review/applyRedactions";
import { buildReviewStateFromPersistedDecisions } from "../app/review/redactionDecisionPersistence";
import type {
    ManualImageAreaDecision,
    ManualImageDecision,
    PersistedRedactionDecision,
} from "../app/review/types";

const firstArea: ManualImageAreaDecision = {
    id: "area-1",
    documentId: "document-1",
    kind: "image_area",
    pageNumber: 12,
    imageId: "page-12_img_0001",
    areaId: "area-1",
    rect: {
        x0: 0.1,
        y0: 0.2,
        x1: 0.5,
        y1: 0.6,
    },
};

describe("image-area decisions", () => {
    it("preserves geometry in the Apply payload", () => {
        const request = buildApplyRedactionsRequest(
            "document-1",
            [firstArea],
            {},
        );

        expect(request.decisions).toEqual([
            {
                kind: "image_area",
                pageNumber: 12,
                imageId: "page-12_img_0001",
                areaId: "area-1",
                rect: firstArea.rect,
                action: "redact",
                source: "manual",
            },
        ]);
    });

    it("restores stable IDs and normalized rectangles", () => {
        const request = buildApplyRedactionsRequest(
            "document-1",
            [firstArea],
            {},
        );

        const persisted = JSON.parse(
            JSON.stringify(request.decisions),
        ) as PersistedRedactionDecision[];

        const restored = buildReviewStateFromPersistedDecisions(
            "document-1",
            persisted,
        );

        expect(restored.manualSelections).toEqual([firstArea]);
        expect(restored.pageStatuses).toEqual({});
    });

    it("keeps overlapping areas independent", () => {
        const secondArea: ManualImageAreaDecision = {
            ...firstArea,
            id: "area-2",
            areaId: "area-2",
            rect: {
                x0: 0.3,
                y0: 0.4,
                x1: 0.8,
                y1: 0.9,
            },
        };

        const request = buildApplyRedactionsRequest(
            "document-1",
            [firstArea, secondArea],
            {},
        );

        expect(request.decisions).toHaveLength(2);
        expect(request.decisions.map(d => d.kind)).toEqual([
            "image_area",
            "image_area",
        ]);

        const restored = buildReviewStateFromPersistedDecisions(
            "document-1",
            request.decisions as PersistedRedactionDecision[],
        );

        expect(restored.manualSelections).toEqual([
            firstArea,
            secondArea,
        ]);
    });

    it("preserves whole-image redactions", () => {
        const wholeImage: ManualImageDecision = {
            id: "whole-1",
            documentId: "document-1",
            kind: "image",
            pageNumber: 12,
            imageId: "page-12_img_0001",
        };

        const request = buildApplyRedactionsRequest(
            "document-1",
            [wholeImage],
            {},
        );

        expect(request.decisions).toEqual([
            {
                kind: "image",
                pageNumber: 12,
                imageId: "page-12_img_0001",
                action: "redact",
                source: "manual",
            },
        ]);
    });

    it("preserves page decisions alongside image areas", () => {
        const request = buildApplyRedactionsRequest(
            "document-1",
            [firstArea],
            { 15: "exempted" },
        );

        expect(request.decisions).toContainEqual({
            kind: "page",
            pageNumber: 15,
            action: "exempt",
            source: "manual",
        });

        expect(request.decisions[0].kind).toBe("image_area");
    });
});
