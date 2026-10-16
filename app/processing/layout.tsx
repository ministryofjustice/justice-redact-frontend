import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Your file is being processed",
};

export default function ProcessingLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return children;
}