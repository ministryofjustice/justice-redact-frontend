"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ExportContent() {
    const searchParams = useSearchParams();
    const documentId = searchParams.get("documentId");

    return (
        <div>
            <p>Exporting document: {documentId}</p>
        </div>
    );
}

export default function ExportPage() {
    return (
        <Suspense fallback={<div>Loading export page...</div>}>
            <ExportContent />
        </Suspense>
    );
}
