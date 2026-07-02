import FilenameBar from "@/app/components/FilenameBar";

type ReviewControlsHeaderProps = {
    filename: string;
    isPreviewMode: boolean;
    onSetRedactMode: () => void;
    onSetPreviewMode: () => void;
};

export default function ReviewControlsHeader({
    filename,
    isPreviewMode,
    onSetRedactMode,
    onSetPreviewMode,
}: ReviewControlsHeaderProps) {
    return (
        <header className="sticky-container" aria-label="Review controls">
            <FilenameBar filename={filename} />

            <div className="actions-bar" aria-label="Review actions">
                <div className="govuk-button-group">
                    <p className="govuk-body">
                        <strong>Menu:</strong>
                    </p>

                    <a href="#" className="govuk-link govuk-link--no-visited-state">
                        Find and redact
                    </a>
                    <a href="#" className="govuk-link govuk-link--no-visited-state">
                        Find and unredact
                    </a>
                    <a href="#" className="govuk-link govuk-link--no-visited-state">
                        Edit allow list
                    </a>
                    <a href="#" className="govuk-link govuk-link--no-visited-state">
                        Quick help
                    </a>

                    <p className="govuk-body jr-modes-label">
                        <strong>Modes:</strong>
                    </p>

                    <button
                        type="button"
                        className="toggle-button-v2"
                        aria-pressed={!isPreviewMode}
                        aria-label="Switch to redact mode"
                        onClick={onSetRedactMode}
                    >
                        Redact
                    </button>

                    <button
                        type="button"
                        className="toggle-button-v2"
                        aria-pressed={isPreviewMode}
                        aria-label="Switch to preview mode"
                        onClick={onSetPreviewMode}
                    >
                        Preview
                    </button>
                </div>
            </div>
        </header>
    );
}