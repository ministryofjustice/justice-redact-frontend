import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Enter the person's details",
};

export default function SubjectDetailsLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return children;
}