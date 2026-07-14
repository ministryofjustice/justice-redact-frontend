type FindInDocumentMenuProps = {
    onFindAndRedact: () => void;
    onFindAndPartiallyRedact: () => void;
    onFindAndDisclose: () => void;
};

export default function FindInDocumentMenu({
    onFindAndRedact,
    onFindAndPartiallyRedact,
    onFindAndDisclose,
}: FindInDocumentMenuProps) {
    return (
        <div
            className="moj-button-menu"
            data-module="moj-button-menu"
            data-button-text="Find in document"
            data-button-classes="govuk-button--secondary"
        >
            <button
                type="button"
                className="govuk-button moj-button-menu__item govuk-button--secondary"
                onClick={onFindAndRedact}
            >
                Find and redact
            </button>

            <button
                type="button"
                className="govuk-button moj-button-menu__item govuk-button--secondary"
                onClick={onFindAndPartiallyRedact}
            >
                Find and partially redact
            </button>

            <button
                type="button"
                className="govuk-button moj-button-menu__item govuk-button--secondary"
                onClick={onFindAndDisclose}
            >
                Find and disclose
            </button>
        </div>
    );
}