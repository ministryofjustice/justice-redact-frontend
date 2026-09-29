import type { ReactNode } from "react";

import RequireAuthentication from "../components/RequireAuthentication";

export default function BeforeYouStartLayout({
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
