import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Redactions applied",
};

export default function ExportLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return children;
}