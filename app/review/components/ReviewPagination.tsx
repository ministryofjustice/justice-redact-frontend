type PageRange = {
    start: number;
    end: number;
};

type ReviewPaginationProps = {
    pageRanges: PageRange[];
    selectedRangeStart: number;
    onSelectRangeStart: (rangeStart: number) => void;
};

export default function ReviewPagination({
    pageRanges,
    selectedRangeStart,
    onSelectRangeStart,
}: ReviewPaginationProps) {
    return (
        <nav className="jr-pagination" aria-label="Page navigation">
            {pageRanges.map((range) => {
                const label = `${range.start + 1} - ${range.end + 1}`;
                const isSelected = selectedRangeStart === range.start;

                return (
                    <button
                        key={`${range.start}-${range.end}`}
                        type="button"
                        className="govuk-button govuk-button--secondary"
                        aria-current={isSelected ? "page" : undefined}
                        disabled={isSelected}
                        onClick={() => onSelectRangeStart(range.start)}
                    >
                        {label}
                    </button>
                );
            })}
        </nav>
    );
}