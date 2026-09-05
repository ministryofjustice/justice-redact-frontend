import type { PageStatus } from "../types";

type ReviewPageHeaderProps = {
    pageNumber: number;
    pageStatus?: PageStatus;
    onExempt: (pageNumber: number) => void;
    onDelete: (pageNumber: number) => void;
    onRestore: (pageNumber: number) => void;
};

export default function ReviewPageHeader({
    pageNumber,
    pageStatus,
    onExempt,
    onDelete,
    onRestore,
}: ReviewPageHeaderProps) {
    return (
        <>
            <div className="jr-review-page__header">
                <div className="jr-review-page__header-content">
                    <h2
                        className="govuk-heading-m govuk-!-margin-bottom-0"
                        id={`review-page-${pageNumber}-heading`}
                    >
                        Page {pageNumber}
                    </h2>

                    {pageStatus && (
                        <strong
                            className={`govuk-tag ${pageStatus === "deleted"
                                    ? "govuk-tag--red"
                                    : "govuk-tag--blue"
                                }`}
                        >
                            {pageStatus === "deleted" ? "Deleted" : "Exempted"}
                        </strong>
                    )}
                </div>
            </div>

            <div className="moj-button-group jr-review-page__actions">
                {pageStatus ? (
                    <button
                        type="button"
                        className="govuk-button govuk-button--secondary"
                        data-module="govuk-button"
                        onClick={() => onRestore(pageNumber)}
                    >
                        Restore page {pageNumber}
                    </button>
                ) : (
                    <>
                        <button
                            type="button"
                            className="govuk-button govuk-button--secondary"
                            data-module="govuk-button"
                            onClick={() => onExempt(pageNumber)}
                        >
                            Exempt page {pageNumber}
                        </button>

                        <button
                            type="button"
                            className="govuk-button govuk-button--secondary"
                            data-module="govuk-button"
                            onClick={() => onDelete(pageNumber)}
                        >
                            Delete page {pageNumber}
                        </button>
                    </>
                )}
            </div>
        </>
    );
}