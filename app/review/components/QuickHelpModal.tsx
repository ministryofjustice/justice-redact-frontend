"use client";

import Modal from "./Modal";

type QuickHelpModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

export default function QuickHelpModal({
    isOpen,
    onClose,
}: QuickHelpModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            title="Quick help"
            onClose={onClose}
        >
            <h3 className="govuk-heading-m">
                AI assistance
            </h3>

            <p className="govuk-body">
                Justice Redact is a tool that allows you to redact documents.
                It uses AI to highlight words and phrases you might want to pay
                attention to.
            </p>

            <p className="govuk-body">
                The AI is only there to help. It won&apos;t make any decisions
                for you.
            </p>

            <h3 className="govuk-heading-m">
                Highlights
            </h3>

            <ul className="govuk-list govuk-list--spaced">
                <li>
                    <span className="highlight highlight--suggestion">
                        AI suggestions
                    </span>{" "}
                    are highlighted blue. They will not appear in any exported
                    documents when redactions are applied.
                </li>

                <li>
                    <span className="highlight highlight--redaction jr-quick-help__redaction-example">
                        Redactions
                    </span>{" "}
                    are highlighted orange. Click these highlights to remove
                    them.
                </li>
            </ul>

            <button
                type="button"
                className="govuk-link govuk-link--no-visited-state jr-modal__link-button"
                onClick={onClose}
            >
                Close this window
            </button>
        </Modal>
    );
}