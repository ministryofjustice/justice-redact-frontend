import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "There is a newer version of these files",
};

export default function SupersededExportLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return children;
}