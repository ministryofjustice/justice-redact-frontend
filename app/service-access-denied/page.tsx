import type { Metadata } from "next";

import ServiceErrorPage from "../components/ServiceErrorPage";

export const metadata: Metadata = {
    title: "You do not have access to this service",
};

export default function ServiceAccessDeniedPage() {
    return (
        <ServiceErrorPage variant={403} />
    );
}