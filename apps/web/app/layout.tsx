import "@/styles/globals.css";
import { inter, googleSans } from "@/styles/fonts";
import Script from "next/script";
import Providers from "./providers";
import { constructMetadata } from "@repo/utils";

export const metadata = constructMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${googleSans.variable}`}>
        <Script id="analytics-queue" strategy="beforeInteractive">
          {`window.analytics = window.analytics || { q: [] };`}
        </Script>
        <Script
          src="/analytics.js"
          strategy="afterInteractive"
          data-api="/api/track"
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
