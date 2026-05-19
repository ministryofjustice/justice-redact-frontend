"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

// 1. Put everything that uses searchParams or dynamic states into an inner component
function ExportContent() {
    const searchParams = useSearchParams();
    const documentId = searchParams.get("documentId");

    return (
        <div>
            {/* Your existing export page layout and logic goes here */}
            <p>Exporting document: {documentId}</p>
        </div>
    );
}

// 2. Wrap it with Suspense in the main page export
export default function ExportPage() {
    return (
        <Suspense fallback={<div>Loading export page...</div>}>
            <ExportContent />
        </Suspense>
    );
}
