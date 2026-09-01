"use client";

import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";

function AppToaster() {
  const { resolvedTheme, forcedTheme } = useTheme();
  const activeTheme = forcedTheme ?? resolvedTheme;

  return (
    <Toaster
      closeButton
      theme={activeTheme === "dark" ? "dark" : "light"}
      icons={{
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
    />
  );
}

/**
 * Per-section theming wrapper.
 *
 * Each top-level route group renders its own `ThemeShell` instead of relying on
 * a single global provider. Sections that pass `forcedTheme` (auth, invites) are
 * pinned to that theme for the DOM only — next-themes never writes to
 * localStorage while a theme is forced, so the user's saved light/dark
 * preference is left untouched and is restored automatically when they land back
 * on a themable section (dashboard, shared, onboarding).
 *
 * Nesting a second `ThemeProvider` is a documented no-op in next-themes, so it's
 * safe for deeper layouts to remain unaware of this.
 */
export function ThemeShell({
  children,
  forcedTheme,
}: {
  children: React.ReactNode;
  forcedTheme?: "light" | "dark";
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={forcedTheme}
    >
      {children}
      <AppToaster />
    </ThemeProvider>
  );
}
