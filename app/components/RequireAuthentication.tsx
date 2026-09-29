"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { ApiError, fetchJson } from "../lib/api";
import ServiceErrorPage from "./ServiceErrorPage";

type CurrentUserResponse = {
    userId: string;
    email: string;
};

type RequireAuthenticationProps = {
    children: ReactNode;
};

export default function RequireAuthentication({
    children,
}: RequireAuthenticationProps) {

    const [isChecking, setIsChecking] = useState(true);
    const [hasServiceError, setHasServiceError] =
        useState(false);

    useEffect(() => {
        let isActive = true;

        async function checkAuthentication() {
            try {
                await fetchJson<CurrentUserResponse>(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`,
                    {
                        cache: "no-store",
                        redirectOnUnauthorized: false,
                    },
                );

                if (!isActive) {
                    return;
                }

                setIsChecking(false);
            } catch (error) {
                if (!isActive) {
                    return;
                }

                if (
                    error instanceof ApiError &&
                    error.status === 401
                ) {
                    window.location.replace("/");
                    return;
                }

                setHasServiceError(true);
                setIsChecking(false);
            }
        }

        void checkAuthentication();

        return () => {
            isActive = false;
        };
    }, []);

    if (isChecking) {
        return null;
    }

    if (hasServiceError) {
        return <ServiceErrorPage variant={503} />;
    }

    return children;
}
