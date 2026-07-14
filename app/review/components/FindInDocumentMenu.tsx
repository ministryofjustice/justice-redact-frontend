export default function FindInDocumentMenu() {
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
                data-module="govuk-button"
            >
                Find and redact
            </button>

            <button
                type="button"
                className="govuk-button moj-button-menu__item govuk-button--secondary"
                data-module="govuk-button"
            >
                Find and partially redact
            </button>

            <button
                type="button"
                className="govuk-button moj-button-menu__item govuk-button--secondary"
                data-module="govuk-button"
            >
                Find and disclose
            </button>
        </div>
    );
}