import "./globals.scss";
import type { Metadata } from "next";
import Link from "next/link";
import MojCrest from "./components/MojCrest";
import GovukInit from "./components/GovukInit";
import GovukFooter from "./components/GovukFooter";

export const metadata: Metadata = {
  title: "Justice Redact",
  description: "Show and tell demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="govuk-template js-enabled">
      <head>
        <link rel="stylesheet" href="/styles/govuk-frontend.min.css" />
        <link rel="stylesheet" href="/styles/moj-frontend.min.css" />
      </head>

      <body className="govuk-template__body govuk-frontend-supported jr-app-body">
        <GovukInit />

        <a href="#main-content" className="govuk-skip-link">
          Skip to main content
        </a>

        <header className="moj-header" role="banner">
          <div className="moj-header__container govuk-width-container">
            <div className="moj-header__logo">
              <MojCrest />

              <div className="moj-header__content">
                <Link className="moj-header__link moj-header__link--organisation-name" href="/">
                  Ministry of Justice
                </Link>

                <Link className="moj-header__link moj-header__link--service-name" href="/">
                  Justice Redact
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="govuk-width-container jr-app-content">
          <main className="govuk-main-wrapper" id="main-content">
            {children}
          </main>
        </div>

        <GovukFooter />
      </body>
    </html>
  );
}
