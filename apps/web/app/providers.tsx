"use client";

import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";

function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      closeButton
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      icons={{
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
    />
  );
}

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <AppToaster />
    </ThemeProvider>
  );
}