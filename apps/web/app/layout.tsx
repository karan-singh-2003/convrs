import "../styles/globals.css";
import { inter, googleSans, poppins, bricolageGrotesque ,alexandria} from "@/styles/fonts";
import { constructMetadata } from "@repo/utils";

export const metadata = constructMetadata();

/**
 * No theme provider lives here on purpose.
 *
 * Theming is scoped per route group via `ThemeShell`
 * (`app/app.convrs.dev/theme-shell.tsx`) so that auth / onboarding / invites can
 * pin themselves to light mode. next-themes treats a nested `ThemeProvider` as a
 * no-op, so a root provider would silently disable every `forcedTheme` below it.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${googleSans.variable} ${poppins.variable} ${bricolageGrotesque.variable} ${alexandria.variable} `}
      >
        {children}
      </body>
    </html>
  );
}
