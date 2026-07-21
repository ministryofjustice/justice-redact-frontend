import FilenameBar from "@/app/components/FilenameBar";
import type { ReviewMode } from "../types";
import ModeToggleGroup from "./ModeToggleGroup";
import FindInDocumentMenu from "./FindInDocumentMenu";
import QuickHelpButton from "./QuickHelpButton";

type ReviewControlsHeaderProps = {
    filename: string;
    reviewMode: ReviewMode;
    onReviewModeChange: (mode: ReviewMode) => void;
    onQuickHelp: () => void;
    onFindAndRedact: () => void;
    onFindAndDisclose: () => void;
};

export default function ReviewControlsHeader({
    filename,
    reviewMode,
    onReviewModeChange,
    onQuickHelp,
    onFindAndRedact,
    onFindAndDisclose,
}: ReviewControlsHeaderProps) {
    return (
        <header className="sticky-container" aria-label="Review controls">
            <FilenameBar filename={filename} />

            <div className="actions-bar" aria-label="Review actions">
                <div className="actions-bar__left">
                    <FindInDocumentMenu
                        onFindAndRedact={onFindAndRedact}
                        onFindAndPartiallyRedact={() => { }}
                        onFindAndDisclose={onFindAndDisclose}
                    />

                    <QuickHelpButton onClick={onQuickHelp} />
                </div>
                <ModeToggleGroup
                    value={reviewMode}
                    onChange={onReviewModeChange}
                />
            </div>
        </header>
    );
}