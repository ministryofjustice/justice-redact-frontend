import FilenameBar from "@/app/components/FilenameBar";
import type { ReviewMode } from "../types";
import ModeToggleGroup from "./ModeToggleGroup";
import FindInDocumentMenu from "./FindInDocumentMenu";

type ReviewControlsHeaderProps = {
    filename: string;
    reviewMode: ReviewMode;
    onReviewModeChange: (mode: ReviewMode) => void;
};

export default function ReviewControlsHeader({
    filename,
    reviewMode,
    onReviewModeChange,
}: ReviewControlsHeaderProps) {
    return (
        <header className="sticky-container" aria-label="Review controls">
            <FilenameBar filename={filename} />

            <div className="actions-bar" aria-label="Review actions">
                <div className="govuk-button-group">
                    <p className="govuk-body">
                        <strong>Menu:</strong>
                    </p>
                    <FindInDocumentMenu />
                    <a
                        href="#"
                        className="govuk-link govuk-link--no-visited-state"
                    >
                        Edit allow list
                    </a>
                    <a
                        href="#"
                        className="govuk-link govuk-link--no-visited-state"
                    >
                        Quick help
                    </a>
                    <ModeToggleGroup
                        value={reviewMode}
                        onChange={onReviewModeChange}
                    />
                </div>
            </div>
        </header>
    );
}