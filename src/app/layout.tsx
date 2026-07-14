import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import BetaBanner from "@/components/BetaBanner";
import { BETA_BANNER_KEY, BETA_BANNER_DISMISSED_CLASS } from "@/lib/betaBanner";
import Footer from "@/components/Footer";
import ConsentBanner from "@/components/ConsentBanner";

const lexend = Lexend({
  subsets: ["latin"],
});

const TITLE = "Richmond Summer Camp Finder";
const DESCRIPTION =
  "Find Richmond, VA summer camps by your kid's age, the weeks you need, and how far you're willing to drive — all on one map. Free, no signup.";

/**
 * Facebook needs absolute URLs for og:image, so metadataBase has to resolve to the
 * live domain. On Vercel, VERCEL_PROJECT_PRODUCTION_URL is the production domain even
 * in preview builds; set NEXT_PUBLIC_SITE_URL to override (e.g. a custom domain).
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

// og:image itself comes from src/app/opengraph-image.tsx (the file convention), which
// Next resolves against metadataBase into an absolute URL.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Scouty",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Runs before first paint: a returning visitor who already dismissed the banner
            must never see it flash and then collapse, which would shift the page under
            their thumb mid-tap. React can't read localStorage until after hydration, so
            the class goes on <html> here and globals.css hides the bar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem(${JSON.stringify(
              BETA_BANNER_KEY
            )})==='1'){document.documentElement.classList.add(${JSON.stringify(
              BETA_BANNER_DISMISSED_CLASS
            )})}}catch(e){}`,
          }}
        />
      </head>
      <body className={lexend.className}>
        <Providers>
          {/* Top-of-page bar, in normal flow above the sticky header. */}
          <BetaBanner />
          {children}
          <Footer />
          {/* Fixed to the bottom of the viewport at z-[60] — above everything else,
              including the beta bar, so consent always wins if anything ever meets it. */}
          <ConsentBanner />
        </Providers>
      </body>
    </html>
  );
}
