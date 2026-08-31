export default function HighlightKey() {
    return (
        <div className="govuk-grid-column-full jr-highlight-key">
            <table className="govuk-table govuk-!-width-one-third jr-highlight-key__table">
                <caption className="govuk-table__caption govuk-table__caption--m">
                    Highlighted text
                </caption>

                <thead className="govuk-table__head">
                    <tr className="govuk-table__row">
                        <th scope="col" className="govuk-table__header">
                            Style
                        </th>
                        <th scope="col" className="govuk-table__header">
                            Description
                        </th>
                    </tr>
                </thead>

                <tbody className="govuk-table__body">
                    <tr className="govuk-table__row">
                        <td className="govuk-table__cell">
                            <span className="highlight highlight--suggestion">
                                Suggestion
                            </span>
                        </td>

                        <td className="govuk-table__cell">
                            AI suggestion
                        </td>
                    </tr>

                    <tr className="govuk-table__row">
                        <td className="govuk-table__cell">
                            <span className="highlight highlight--redaction jr-highlight-key__redaction">
                                Redaction
                            </span>
                        </td>

                        <td className="govuk-table__cell">
                            Your redaction
                        </td>
                    </tr>
                </tbody>
            </table>

            <details
                className="govuk-details govuk-!-width-one-half jr-highlight-key__details"
            >
                <summary className="govuk-details__summary">
                    <span className="govuk-details__summary-text">
                        What happens to highlights after applying redactions
                    </span>
                </summary>

                <div className="govuk-details__text">
                    <p className="govuk-body">
                        Justice redact exports three documents:
                    </p>

                    <dl className="govuk-summary-list">
                        <div className="govuk-summary-list__row">
                            <dt className="govuk-summary-list__key govuk-!-width-one-quarter">
                                Redacted
                            </dt>
                            <dd className="govuk-summary-list__value">
                                With redactions blacked out and no AI suggestions highlighted
                            </dd>
                        </div>

                        <div className="govuk-summary-list__row">
                            <dt className="govuk-summary-list__key govuk-!-width-one-quarter">
                                Vetted
                            </dt>
                            <dd className="govuk-summary-list__value">
                                Highlights show what you redacted and what the AI suggested
                            </dd>
                        </div>

                        <div className="govuk-summary-list__row">
                            <dt className="govuk-summary-list__key govuk-!-width-one-quarter">
                                Exempted
                            </dt>
                            <dd className="govuk-summary-list__value">
                                All the pages you exempted with AI suggestions highlighted
                            </dd>
                        </div>
                    </dl>
                </div>
            </details>
        </div>
    );
}