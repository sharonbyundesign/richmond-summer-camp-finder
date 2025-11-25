import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}


