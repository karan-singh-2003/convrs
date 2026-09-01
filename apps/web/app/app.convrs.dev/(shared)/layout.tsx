import { ReactNode } from "react";
import { ThemeShell } from "../theme-shell";

export default function SharedLayout({ children }: { children: ReactNode }) {
  return <ThemeShell>{children}</ThemeShell>;
}
