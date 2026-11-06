"use client";

import { useCallback, useState } from "react";

import {
    getCachedReviewSearchPages,
    loadReviewSearchPages,
} from "../../../app/review/reviewDataCache";

import type {
    ReviewPageData,
} from "../../../app/review/types";

export function useReviewFindWorkflows(
    documentId: string | null,
) {
    const [
        isFindAndRedactOpen,
        setIsFindAndRedactOpen,
    ] = useState(false);

    const [
        isFindAndPartiallyRedactOpen,
        setIsFindAndPartiallyRedactOpen,
    ] = useState(false);

    const [
        isFindAndDiscloseOpen,
        setIsFindAndDiscloseOpen,
    ] = useState(false);

    const [
        hasFindAndRedactError,
        setHasFindAndRedactError,
    ] = useState(false);

    const [
        hasFindAndPartiallyRedactError,
        setHasFindAndPartiallyRedactError,
    ] = useState(false);

    const [
        hasFindAndDiscloseError,
        setHasFindAndDiscloseError,
    ] = useState(false);

    const [
        searchPages,
        setSearchPages,
    ] = useState<ReviewPageData[] | null>(() => {
        if (!documentId) {
            return null;
        }

        return (
            getCachedReviewSearchPages(documentId) ?? null
        );
    });

    const [
        isSearchLoading,
        setIsSearchLoading,
    ] = useState(false);

    const [
        searchError,
        setSearchError,
    ] = useState<string | null>(null);

    const ensureSearchPages = useCallback(async () => {
        if (!documentId) {
            return null;
        }

        if (searchPages) {
            return searchPages;
        }

        try {
            setIsSearchLoading(true);
            setSearchError(null);

            const pages =
                await loadReviewSearchPages(documentId);

            setSearchPages(pages);

            return pages;
        } catch (error) {
            setSearchError(
                error instanceof Error
                    ? error.message
                    : "Failed to load document search data.",
            );

            return null;
        } finally {
            setIsSearchLoading(false);
        }
    }, [documentId, searchPages]);

    const openFindAndRedact = useCallback(async () => {
        const pages = await ensureSearchPages();

        if (!pages) {
            return;
        }

        setIsFindAndPartiallyRedactOpen(false);
        setIsFindAndDiscloseOpen(false);
        setIsFindAndRedactOpen(true);
    }, [ensureSearchPages]);

    const openFindAndPartiallyRedact =
        useCallback(async () => {
            const pages = await ensureSearchPages();

            if (!pages) {
                return;
            }

            setIsFindAndRedactOpen(false);
            setIsFindAndDiscloseOpen(false);
            setIsFindAndPartiallyRedactOpen(true);
        }, [ensureSearchPages]);

    const openFindAndDisclose = useCallback(async () => {
        const pages = await ensureSearchPages();

        if (!pages) {
            return;
        }

        setIsFindAndRedactOpen(false);
        setIsFindAndPartiallyRedactOpen(false);
        setIsFindAndDiscloseOpen(true);
    }, [ensureSearchPages]);

    return {
        isFindAndRedactOpen,
        setIsFindAndRedactOpen,
        isFindAndPartiallyRedactOpen,
        setIsFindAndPartiallyRedactOpen,
        isFindAndDiscloseOpen,
        setIsFindAndDiscloseOpen,

        hasFindAndRedactError,
        setHasFindAndRedactError,
        hasFindAndPartiallyRedactError,
        setHasFindAndPartiallyRedactError,
        hasFindAndDiscloseError,
        setHasFindAndDiscloseError,

        searchPages,
        isSearchLoading,
        searchError,

        openFindAndRedact,
        openFindAndPartiallyRedact,
        openFindAndDisclose,
    };
}
