import { ReactNode } from "react";
import { ThemeShell } from "../theme-shell";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ThemeShell forcedTheme="light">{children}</ThemeShell>;
}
