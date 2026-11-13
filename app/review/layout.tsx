import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Make redactions",
};

export default function ReviewLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return children;
}