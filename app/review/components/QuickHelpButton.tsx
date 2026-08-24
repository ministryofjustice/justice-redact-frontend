type QuickHelpButtonProps = {
    onClick: () => void;
};

export default function QuickHelpButton({
    onClick,
}: QuickHelpButtonProps) {
    return (
        <button
            type="button"
            className="govuk-button govuk-button--secondary"
            onClick={onClick}
        >
            Quick help
        </button>
    );
}