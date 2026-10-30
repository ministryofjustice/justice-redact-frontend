
import {
    expect,
    test,
    type Page,
    type Route,
} from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:8000";
const DOCUMENT_ID = "document-123";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:3000",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

type WorkflowStage = "uploaded" | "processing";

async function fulfillJson(
    route: Route,
    body: unknown,
    status = 200,
): Promise<void> {
    if (route.request().method() === "OPTIONS") {
        await route.fulfill({
            status: 204,
            headers: CORS_HEADERS,
        });
        return;
    }

    await route.fulfill({
        status,
        contentType: "application/json",
        headers: CORS_HEADERS,
        body: JSON.stringify(body),
    });
}

async function mockWorkflow(
    page: Page,
    stage: { value: WorkflowStage },
): Promise<void> {
    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/workflow`,
        async (route) => {
            const isProcessing = stage.value === "processing";

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: stage.value,
                currentRedactionRunId: null,
                preferredPage: isProcessing
                    ? "processing"
                    : "subject-details",
                allowedPages: [
                    isProcessing
                        ? "processing"
                        : "subject-details",
                ],
            });
        },
    );
}

test("submitting subject details starts document processing", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "uploaded",
    };

    await mockWorkflow(page, stage);

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/process`,
        async (route) => {
            if (route.request().method() === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            expect(route.request().method()).toBe("POST");

            stage.value = "processing";

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "processing",
            });
        },
    );

    await page.goto(
        `/subject-details?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Enter the person's details",
            exact: true,
        }),
    ).toBeVisible();

    await page.getByRole("textbox", {
        name: "Full name (optional)",
    }).fill("Test Subject");

    await page.getByRole("textbox", {
        name: "Prison number (optional)",
    }).fill("A1234BC");

    const processRequest = page.waitForRequest(
        (request) =>
            request.method() === "POST" &&
            request.url() ===
            `${API_BASE_URL}/documents/${DOCUMENT_ID}/process`,
    );

    await page.getByRole("button", {
        name: "Continue",
        exact: true,
    }).click();

    const request = await processRequest;

    expect(request.postDataJSON()).toEqual({
        subjectName: "Test Subject",
        subjectPrisonNumber: "A1234BC",
        otherPhrases: "",
    });

    await expect(page).toHaveURL(
        `/processing?documentId=${DOCUMENT_ID}`,
    );
});

test("subject details can be submitted with both optional fields empty", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "uploaded",
    };

    await mockWorkflow(page, stage);

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/process`,
        async (route) => {
            if (route.request().method() === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            stage.value = "processing";

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "processing",
            });
        },
    );

    await page.goto(
        `/subject-details?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Enter the person's details",
            exact: true,
        }),
    ).toBeVisible();

    const processRequest = page.waitForRequest(
        (request) =>
            request.method() === "POST" &&
            request.url() ===
            `${API_BASE_URL}/documents/${DOCUMENT_ID}/process`,
    );

    await page.getByRole("button", {
        name: "Continue",
        exact: true,
    }).click();

    const request = await processRequest;

    expect(request.postDataJSON()).toEqual({
        subjectName: "",
        subjectPrisonNumber: "",
        otherPhrases: "",
    });

    await expect(page).toHaveURL(
        `/processing?documentId=${DOCUMENT_ID}`,
    );
});

test("processing request failure displays an error and allows retry", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "uploaded",
    };

    await mockWorkflow(page, stage);

    let attempts = 0;

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/process`,
        async (route) => {
            if (route.request().method() === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            attempts += 1;

            if (attempts === 1) {
                await fulfillJson(
                    route,
                    { detail: "Processing could not start" },
                    500,
                );
                return;
            }

            stage.value = "processing";

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "processing",
            });
        },
    );

    await page.goto(
        `/subject-details?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Enter the person's details",
            exact: true,
        }),
    ).toBeVisible();

    await page.getByRole("button", {
        name: "Continue",
        exact: true,
    }).click();

    await expect(
        page.locator(".govuk-error-summary"),
    ).toBeVisible();

    await expect(page).toHaveURL(
        `/subject-details?documentId=${DOCUMENT_ID}`,
    );

    const continueButton = page.getByRole("button", {
        name: "Continue",
        exact: true,
    });

    await expect(continueButton).toBeEnabled();

    await continueButton.click();

    await expect(page).toHaveURL(
        `/processing?documentId=${DOCUMENT_ID}`,
    );

    expect(attempts).toBe(2);
});

test("Back abandons the uploaded document before returning to Upload", async ({
    page,
}) => {
    const stage: { value: WorkflowStage } = {
        value: "uploaded",
    };

    await mockWorkflow(page, stage);

    let abandonRequests = 0;

    await page.route(
        `${API_BASE_URL}/documents/${DOCUMENT_ID}/abandon`,
        async (route) => {
            if (route.request().method() === "OPTIONS") {
                await fulfillJson(route, null);
                return;
            }

            expect(route.request().method()).toBe("POST");

            abandonRequests += 1;

            await fulfillJson(route, {
                documentId: DOCUMENT_ID,
                status: "abandoned",
            });
        },
    );

    await page.route(
        `${API_BASE_URL}/auth/me`,
        async (route) => {
            await fulfillJson(route, {
                authenticated: true,
                email: "tester@justice.gov.uk",
            });
        },
    );

    await page.goto(
        `/subject-details?documentId=${DOCUMENT_ID}`,
    );

    await expect(
        page.getByRole("heading", {
            name: "Enter the person's details",
            exact: true,
        }),
    ).toBeVisible();

    await page.getByRole("link", {
        name: "Back",
        exact: true,
    }).click();

    await expect.poll(
        () => abandonRequests,
    ).toBe(1);

    await expect(page).toHaveURL("/upload");
});
