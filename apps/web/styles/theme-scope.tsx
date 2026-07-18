// apps/web/ui/theme-scope.tsx  (or packages/ui if you want it shared cross-app)
"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeScope({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Avoid a hydration mismatch: render unscoped on the very first paint,
  // then apply the resolved class once mounted client-side.
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <div className={resolvedTheme} suppressHydrationWarning>
      {children}
    </div>
  );
}