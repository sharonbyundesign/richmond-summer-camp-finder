import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "./PostHogProvider";

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
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}


