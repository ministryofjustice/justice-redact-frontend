import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "This document cannot be processed",
};

export default function DocumentWarningLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return children;
}