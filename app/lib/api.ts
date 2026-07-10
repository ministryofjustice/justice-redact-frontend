export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number | null,
        public readonly retryable: boolean,
    ) {
        super(message);
        this.name = "ApiError";
    }
}

function isJsonContentType(contentType: string): boolean {
    const normalisedContentType = contentType.toLowerCase();

    return (
        normalisedContentType.includes("application/json") ||
        normalisedContentType.includes("+json")
    );
}

function isRetryableStatus(status: number): boolean {
    return [408, 429, 502, 503, 504].includes(status);
}

function getErrorDetail(body: unknown): string | null {
    if (
        typeof body === "object" &&
        body !== null &&
        "detail" in body &&
        typeof body.detail === "string"
    ) {
        return body.detail;
    }

    return null;
}

async function readErrorBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";

    try {
        if (isJsonContentType(contentType)) {
            return await response.json();
        }

        return await response.text();
    } catch {
        return null;
    }
}

export async function fetchJson<T>(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<T> {
    const headers = new Headers(init?.headers);

    if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
    }

    let response: Response;

    try {
        response = await fetch(input, {
            ...init,
            headers,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
        }

        throw new ApiError(
            "The service is temporarily unavailable.",
            null,
            true,
        );
    }

    if (!response.ok) {
        const body = await readErrorBody(response);

        throw new ApiError(
            getErrorDetail(body) ??
            `The request failed with status ${response.status}.`,
            response.status,
            isRetryableStatus(response.status),
        );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!isJsonContentType(contentType)) {
        throw new ApiError(
            "The service returned an unexpected response.",
            response.status,
            true,
        );
    }

    try {
        return await response.json() as T;
    } catch {
        throw new ApiError(
            "The service returned an invalid JSON response.",
            response.status,
            true,
        );
    }
}