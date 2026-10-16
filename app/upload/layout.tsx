import type { Metadata } from "next";
import type { ReactNode } from "react";

import RequireAuthentication from "../components/RequireAuthentication";

export const metadata: Metadata = {
    title: "Upload a file",
};

export default function UploadLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <RequireAuthentication>
            {children}
        </RequireAuthentication>
    );
}
