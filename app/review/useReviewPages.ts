import {
    useEffect,
    useMemo,
    useState,
} from "react";

import type {
    ReviewPageData,
} from "./types";

import {
    getCachedReviewPages,
    loadReviewPages,
} from "./reviewDataCache";


type LoadedPagesState = {
    key: string | null;
    pages: ReviewPageData[];
};

type ErrorState = {
    key: string | null;
    message: string | null;
};


export function useReviewPages(
    documentId: string | null,
    pageStart: number,
    pageEnd: number | null,
    enabled = true
) {
    const requestKey = useMemo(() => {
        if (
            !enabled ||
            !documentId ||
            pageEnd === null
        ) {
            return null;
        }

        return (
            `${documentId}:` +
            `${pageStart}:` +
            `${pageEnd}`
        );
    }, [
        documentId,
        enabled,
        pageEnd,
        pageStart,
    ]);

    const [loaded, setLoaded] =
        useState<LoadedPagesState>(
            {
                key: null,
                pages: [],
            }
        );

    const [errorState, setErrorState] =
        useState<ErrorState>({
            key: null,
            message: null,
        });

    useEffect(() => {
        if (
            !requestKey ||
            !documentId ||
            pageEnd === null
        ) {
            return;
        }

        let isActive = true;

        const cached =
            getCachedReviewPages(
                documentId,
                pageStart,
                pageEnd
            );

        if (cached) {
            setLoaded({
                key: requestKey,
                pages: cached,
            });

            setErrorState({
                key: null,
                message: null,
            });

            return;
        }

        async function loadPages() {
            try {
                setErrorState({
                    key: null,
                    message: null,
                });

                const result =
                    await loadReviewPages(
                        documentId!,
                        pageStart,
                        pageEnd!
                    );

                if (!isActive) {
                    return;
                }

                setLoaded({
                    key: requestKey,
                    pages: result,
                });
            } catch (err) {
                if (!isActive) {
                    return;
                }

                setErrorState({
                    key: requestKey,
                    message:
                        err instanceof Error
                            ? err.message
                            : "Failed to load review pages.",
                });
            }
        }

        void loadPages();

        return () => {
            isActive = false;
        };
    }, [
        documentId,
        pageEnd,
        pageStart,
        requestKey,
    ]);

    const pages =
        loaded.key === requestKey
            ? loaded.pages
            : [];

    const error =
        errorState.key === requestKey
            ? errorState.message
            : null;

    const isLoading =
        requestKey !== null &&
        loaded.key !== requestKey &&
        errorState.key !== requestKey;

    return {
        pages,
        isLoading,
        error,
    };
}