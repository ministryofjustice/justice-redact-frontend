import type { ReactNode } from "react";

import RequireAuthentication from "../components/RequireAuthentication";

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
