const VERIFICATION_EMAIL_KEY =
    "justice-redact-verification-email";

export function setVerificationEmail(
    email: string,
) {
    window.sessionStorage.setItem(
        VERIFICATION_EMAIL_KEY,
        email,
    );
}

export function getVerificationEmail():
    string | null {
    return window.sessionStorage.getItem(
        VERIFICATION_EMAIL_KEY,
    );
}

export function clearVerificationEmail() {
    window.sessionStorage.removeItem(
        VERIFICATION_EMAIL_KEY,
    );
}

export function subscribeToVerificationEmail() {
    return () => { };
}
