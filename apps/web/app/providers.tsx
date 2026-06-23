'use client'
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster className="pointer-events-auto" closeButton icons={{
        loading: <Loader2 className="size-4 animate-spin" />,
      }} />
    </>
  );
}