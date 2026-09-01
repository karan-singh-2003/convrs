import { ReactNode } from "react";
import { ThemeShell } from "../theme-shell";

export default function InvitesLayout({ children }: { children: ReactNode }) {
  return <ThemeShell forcedTheme="light">{children}</ThemeShell>;
}
