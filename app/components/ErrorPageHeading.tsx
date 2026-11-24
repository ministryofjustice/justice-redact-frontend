"use client";

import { useEffect, useRef } from "react";

type ErrorPageHeadingProps = {
    children: string;
};

export default function ErrorPageHeading({
    children,
}: ErrorPageHeadingProps) {
    const headingRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        headingRef.current?.focus();
    }, [children]);

    return (
        <h1
            ref={headingRef}
            className="govuk-heading-xl"
            tabIndex={-1}
        >
            {children}
        </h1>
    );
}