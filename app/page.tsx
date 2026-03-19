import Link from "next/link";

export default function StartPage() {
  return (
    <div className="govuk-grid-row">
      <div className="govuk-grid-column-two-thirds">
        <h1 className="govuk-heading-xl">Before you start</h1>

        <p className="govuk-body-l govuk-secondary-text-colour">
          Justice Redact uses an AI model to highlight information that you might want to redact.
        </p>

        <h2 className="govuk-heading-m">How it works</h2>

        <p className="govuk-body">
          When you upload a document, the AI model will attempt to identify blank pages and
          highlight information in the document that you might want to redact.
        </p>

        <details className="govuk-details">
          <summary className="govuk-details__summary">
            <span className="govuk-details__summary-text">
              What information will the AI model attempt to highlight?
            </span>
          </summary>
          <div className="govuk-details__text">
            <p>The AI model will attempt to highlight:</p>
            <ul className="govuk-list govuk-list--bullet">
              <li>prisoner numbers</li>
              <li>email addresses</li>
              <li>postcodes</li>
              <li>vehicle registrations</li>
              <li>phone numbers</li>
              <li>NHS numbers</li>
              <li>National Insurance numbers</li>
              <li>credit and debit card numbers</li>
              <li>names</li>
            </ul>
          </div>
        </details>

        <div className="govuk-inset-text guidance-panel">
          <p>
            You decide what to remove and redact. The AI model only highlights information you
            might want to pay attention to. It doesn’t make any decisions for you.
          </p>
        </div>

        <div className="govuk-form-group">
          <fieldset className="govuk-fieldset">
            <legend className="govuk-visually-hidden">Before you start options</legend>
            <div className="govuk-checkboxes" data-module="govuk-checkboxes">
              <div className="govuk-checkboxes__item">
                <input
                  className="govuk-checkboxes__input"
                  id="dont-show-again"
                  name="dont-show-again"
                  type="checkbox"
                  value="dont-show-again"
                />
                <label className="govuk-label govuk-checkboxes__label" htmlFor="dont-show-again">
                  Don&apos;t show this screen again
                </label>
              </div>
            </div>
          </fieldset>
        </div>

        <Link href="/upload" className="govuk-button govuk-button--start">
          Start now
          <svg
            className="govuk-button__start-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="17.5"
            height="19"
            viewBox="0 0 33 40"
            aria-hidden="true"
            focusable="false"
          >
            <path fill="currentColor" d="M0 0h13l20 20-20 20H0l20-20z" />
          </svg>
        </Link>
      </div>
    </div>
  );
}