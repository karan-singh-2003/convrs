import "@/styles/globals.css";
import { inter, googleSans } from "@/styles/fonts";
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
