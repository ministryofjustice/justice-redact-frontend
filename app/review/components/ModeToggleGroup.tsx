import type { ReviewMode } from "../types";

type ModeToggleGroupProps = {
    value: ReviewMode;
    onChange: (mode: ReviewMode) => void;
};

const modes: Array<{ value: ReviewMode; label: string }> = [
    { value: "select", label: "Select" },
    { value: "redact", label: "Redact" },
    { value: "preview", label: "Preview" },
];

export default function ModeToggleGroup({
    value,
    onChange,
}: ModeToggleGroupProps) {
    return (
        <div
            className="jr-mode-toggle"
            role="group"
            aria-label="Review mode"
        >
            <p className="govuk-body jr-mode-toggle__label">
                <strong>Mode:</strong>
            </p>

            <div className="moj-button-group jr-mode-toggle__buttons">
                {modes.map((mode) => {
                    const isActive = value === mode.value;

                    return (
                        <button
                            key={mode.value}
                            type="button"
                            className={[
                                "govuk-button",
                                "govuk-button--secondary",
                                "jr-mode-toggle__button",
                                isActive ? "jr-mode-toggle__button--active" : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            aria-pressed={isActive}
                            onClick={() => onChange(mode.value)}
                        >
                            {mode.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}