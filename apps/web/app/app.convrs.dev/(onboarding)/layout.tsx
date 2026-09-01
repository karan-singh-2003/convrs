import { ReactNode } from "react";
import { ThemeShell } from "../theme-shell";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <ThemeShell>{children}</ThemeShell>;
}
