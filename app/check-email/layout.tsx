import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Check your email account",
};

export default function CheckEmailLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return children;
}