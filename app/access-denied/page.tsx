import ServiceErrorPage from "../components/ServiceErrorPage";

export default function AccessDeniedPage() {
    return <ServiceErrorPage variant={403} />;
}