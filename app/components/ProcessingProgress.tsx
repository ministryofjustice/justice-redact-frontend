"use client";

import {
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const PROGRESS_STEP_INTERVAL_MS = 50;

export function normaliseProcessingProgress(
    progress: number,
): number {
    if (!Number.isFinite(progress)) {
        return 0;
    }

    return Math.min(
        100,
        Math.max(0, Math.floor(progress)),
    );
}

export function getProgressMilestone(
    progress: number,
): number {
    if (progress >= 100) {
        return 100;
    }

    if (progress >= 75) {
        return 75;
    }

    if (progress >= 50) {
        return 50;
    }

    if (progress >= 25) {
        return 25;
    }

    return 0;
}

export function getDisplayedProcessingProgress(
    progress: number,
    prefersReducedMotion: boolean,
): number {
    return prefersReducedMotion
        ? getProgressMilestone(progress)
        : progress;
}

function subscribeToReducedMotion(
    onStoreChange: () => void,
): () => void {
    const mediaQuery = window.matchMedia(
        REDUCED_MOTION_QUERY,
    );

    mediaQuery.addEventListener(
        "change",
        onStoreChange,
    );

    return () => {
        mediaQuery.removeEventListener(
            "change",
            onStoreChange,
        );
    };
}

function getReducedMotionSnapshot(): boolean {
    return window.matchMedia(
        REDUCED_MOTION_QUERY,
    ).matches;
}

function getReducedMotionServerSnapshot(): boolean {
    return false;
}

function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribeToReducedMotion,
        getReducedMotionSnapshot,
        getReducedMotionServerSnapshot,
    );
}

type ProcessingProgressProps = {
    progress: number;
    ariaLabel: string;
};

export default function ProcessingProgress({
    progress,
    ariaLabel,
}: ProcessingProgressProps) {
    const prefersReducedMotion =
        usePrefersReducedMotion();

    const normalisedProgress =
        normaliseProcessingProgress(progress);

    const [animatedProgress, setAnimatedProgress] =
        useState(normalisedProgress);

    const targetProgressRef = useRef(
        normalisedProgress,
    );

    targetProgressRef.current = normalisedProgress;

    useEffect(() => {
        if (prefersReducedMotion) {
            return;
        }

        const intervalId = window.setInterval(() => {
            setAnimatedProgress((currentProgress) => {
                const targetProgress =
                    targetProgressRef.current;

                if (currentProgress >= targetProgress) {
                    return currentProgress;
                }

                return currentProgress + 1;
            });
        }, PROGRESS_STEP_INTERVAL_MS);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [prefersReducedMotion]);

    const displayedProgress = prefersReducedMotion
        ? getProgressMilestone(normalisedProgress)
        : animatedProgress;

    const announcementProgress =
        getProgressMilestone(normalisedProgress);

    return (
        <div className="jr-processing-progress">
            <div
                className="jr-processing-progress__track"
                role="progressbar"
                aria-label={ariaLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={displayedProgress}
            >
                <span
                    className="jr-processing-progress__bar"
                    style={{
                        width: `${displayedProgress}%`,
                    }}
                />
            </div>

            <h2 className="govuk-heading-m jr-processing-progress__label">
                Progress {displayedProgress}%
            </h2>

            <span
                className="govuk-visually-hidden"
                aria-live="polite"
                aria-atomic="true"
            >
                Progress {announcementProgress}%
            </span>
        </div>
    );
}