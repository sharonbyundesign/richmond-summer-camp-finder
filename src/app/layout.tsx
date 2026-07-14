import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Footer from "@/components/Footer";
import ConsentBanner from "@/components/ConsentBanner";

const lexend = Lexend({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Richmond Summer Camp Finder",
  description: "Find the perfect summer camp in Richmond",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={lexend.className}>
        <Providers>
          {children}
          <Footer />
          <ConsentBanner />
        </Providers>
      </body>
    </html>
  );
}
