import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Your redactions are being applied",
};

export default function ApplyingRedactionsLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return children;
}