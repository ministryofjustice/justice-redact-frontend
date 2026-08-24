type FilenameBarProps = {
    filename: string;
};

export default function FilenameBar({
    filename,
}: FilenameBarProps) {
    return (
        <div className="filename-bar">
            <p className="filename-bar__text">
                <span className="filename-bar__prefix">
                    You are reviewing
                </span>{" "}
                <strong className="filename-bar__name">
                    {filename}
                </strong>
            </p>
        </div>
    );
}