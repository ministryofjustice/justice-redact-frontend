export const dynamic = "force-dynamic";

export async function GET() {
    return Response.json(
        {
            status: "ok",
            service: "justice-redact-frontend",
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version ?? "unknown",
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-store",
            },
        },
    );
}

export async function HEAD() {
    return new Response(null, { status: 200 });
}