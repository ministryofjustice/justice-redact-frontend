type PageRange = {
    start: number;
    end: number;
};

type ReviewPaginationProps = {
    pageRanges: PageRange[];
    selectedRangeStart: number;
    totalPages: number;
    onSelectRangeStart: (start: number) => void;
};

type PaginationItem =
    | {
        type: "range";
        range: PageRange;
    }
    | {
        type: "ellipsis";
        key: string;
    };

function buildVisibleItems(
    pageRanges: PageRange[],
    selectedIndex: number
): PaginationItem[] {
    if (pageRanges.length <= 5) {
        return pageRanges.map((range) => ({
            type: "range",
            range,
        }));
    }

    const visibleIndexes = new Set<number>([
        0,
        1,
        2,
        selectedIndex - 1,
        selectedIndex,
        selectedIndex + 1,
        pageRanges.length - 1,
    ]);

    const validIndexes = Array.from(visibleIndexes)
        .filter((index) => index >= 0 && index < pageRanges.length)
        .sort((a, b) => a - b);

    const items: PaginationItem[] = [];

    validIndexes.forEach((index, position) => {
        const previousIndex = validIndexes[position - 1];

        if (
            position > 0 &&
            previousIndex !== undefined &&
            index - previousIndex > 1
        ) {
            items.push({
                type: "ellipsis",
                key: `ellipsis-${previousIndex}-${index}`,
            });
        }

        items.push({
            type: "range",
            range: pageRanges[index],
        });
    });

    return items;
}

export default function ReviewPagination({
    pageRanges,
    selectedRangeStart,
    totalPages,
    onSelectRangeStart,
}: ReviewPaginationProps) {
    if (pageRanges.length === 0) return null;

    const selectedIndex = Math.max(
        0,
        pageRanges.findIndex(
            (range) => range.start === selectedRangeStart
        )
    );

    const currentRange = pageRanges[selectedIndex];
    const previousRange = pageRanges[selectedIndex - 1];
    const nextRange = pageRanges[selectedIndex + 1];
    const visibleItems = buildVisibleItems(pageRanges, selectedIndex);

    function selectRange(start: number) {
        onSelectRangeStart(start);

        window.requestAnimationFrame(() => {
            document
                .querySelector(".jr-review-page")
                ?.scrollIntoView({
                    block: "start",
                    behavior: "instant",
                });
        });
    }

    return (
        <div className="moj-pagination jr-pagination">
            <nav
                className="govuk-pagination moj-pagination__pagination"
                aria-label="Pagination"
            >
                {previousRange && (
                    <div className="govuk-pagination__prev">
                        <button
                            type="button"
                            className="govuk-link govuk-pagination__link jr-pagination__link-button"
                            onClick={() => selectRange(previousRange.start)}
                            rel="prev"
                        >
                            <svg
                                className="govuk-pagination__icon govuk-pagination__icon--prev"
                                xmlns="http://www.w3.org/2000/svg"
                                height="13"
                                width="15"
                                aria-hidden="true"
                                focusable="false"
                                viewBox="0 0 15 13"
                            >
                                <path d="m6.5938-0.0078125 1.4136 1.414-4.2926 4.293h12.986v2h-12.896l4.1855 3.9766-1.377 1.4492-6.7441-6.4062 6.7246-6.7266z" />
                            </svg>

                            <span className="govuk-pagination__link-title">
                                Previous
                            </span>
                        </button>
                    </div>
                )}

                <ul className="govuk-pagination__list">
                    {visibleItems.map((item) => {
                        if (item.type === "ellipsis") {
                            return (
                                <li
                                    key={item.key}
                                    className="govuk-pagination__item govuk-pagination__item--ellipsis"
                                >
                                    <span aria-hidden="true">⋯</span>
                                    <span className="govuk-visually-hidden">
                                        More page ranges
                                    </span>
                                </li>
                            );
                        }

                        const { range } = item;
                        const isCurrent =
                            range.start === currentRange.start;

                        const label = `${range.start + 1} to ${range.end + 1}`;

                        return (
                            <li
                                key={range.start}
                                className={[
                                    "govuk-pagination__item",
                                    isCurrent
                                        ? "govuk-pagination__item--current"
                                        : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            >
                                <button
                                    type="button"
                                    className="govuk-link govuk-pagination__link jr-pagination__link-button"
                                    aria-label={`Pages ${label}`}
                                    aria-current={
                                        isCurrent ? "page" : undefined
                                    }
                                    onClick={() =>
                                        selectRange(range.start)
                                    }
                                >
                                    {label}
                                </button>
                            </li>
                        );
                    })}
                </ul>

                {nextRange && (
                    <div className="govuk-pagination__next">
                        <button
                            type="button"
                            className="govuk-link govuk-pagination__link jr-pagination__link-button"
                            onClick={() => selectRange(nextRange.start)}
                            rel="next"
                        >
                            <span className="govuk-pagination__link-title">
                                Next
                            </span>

                            <svg
                                className="govuk-pagination__icon govuk-pagination__icon--next"
                                xmlns="http://www.w3.org/2000/svg"
                                height="13"
                                width="15"
                                aria-hidden="true"
                                focusable="false"
                                viewBox="0 0 15 13"
                            >
                                <path d="m8.107-0.0078125-1.4136 1.414 4.2926 4.293h-12.986v2h12.896l-4.1855 3.9766 1.377 1.4492 6.7441-6.4062-6.7246-6.7266z" />
                            </svg>
                        </button>
                    </div>
                )}
            </nav>

            <p className="moj-pagination__results">
                Showing {currentRange.start + 1} to {currentRange.end + 1} of{" "}
                {totalPages} total pages
            </p>
        </div>
    );
}