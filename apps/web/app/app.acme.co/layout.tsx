'use client';

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export default function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <SessionProvider>{children}</SessionProvider>;
}
