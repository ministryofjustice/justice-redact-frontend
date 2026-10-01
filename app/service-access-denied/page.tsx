import ServiceErrorPage from "../components/ServiceErrorPage";

export default function ServiceAccessDeniedPage() {
    return (
        <ServiceErrorPage variant={403} />
    );
}