'use client'
import { Toaster } from "sonner";
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster className="pointer-events-auto" closeButton />
    </>
  );
}