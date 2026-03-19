import "./globals.css";
import type { Metadata } from "next";
import MojCrest from "./components/MojCrest";
import Link from "next/link";

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
    <html lang="en" className="govuk-template">
      <head>
        <link rel="stylesheet" href="/styles/govuk-frontend.min.css" />
        <link rel="stylesheet" href="/styles/moj-frontend.min.css" />
      </head>
      <body className="govuk-template__body">
        <a href="#main-content" className="govuk-skip-link">
          Skip to main content
        </a>

        <header className="moj-header" role="banner">
          <div className="moj-header__container govuk-width-container">
            <div className="moj-header__logo">
              <MojCrest />
              <div className="moj-header__content">
                <a className="moj-header__link moj-header__link--organisation-name" href="/">
                  Ministry of Justice
                </a>
                <a className="moj-header__link moj-header__link--service-name" href="/">
                  Justice Redact
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="govuk-width-container">
          <main className="govuk-main-wrapper" id="main-content">
            {children}
          </main>
        </div>

        <footer className="govuk-footer" role="contentinfo">
          <div className="govuk-width-container">
            <div className="govuk-footer__meta">
              <div className="govuk-footer__meta-item govuk-footer__meta-item--grow">
                <h2 className="govuk-visually-hidden">Support links</h2>
              </div>
              <div className="govuk-footer__meta-item">
                <a
                  className="govuk-footer__link govuk-footer__copyright-logo"
                  href="https://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/crown-copyright/"
                >
                  © Crown copyright
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}