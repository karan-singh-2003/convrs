import { Link } from "@react-email/components";
import React from "react";

export default function EmailButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        backgroundColor: "#000",
        color: "#fff",
        padding: "12px 24px",
        fontSize: "14px",
        fontWeight: 500,
        textDecoration: "none",
        display: "inline-block",
        fontFamily:
          "Google Sans, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, ",
      }}
    >
      {children}
    </Link>
  );
}
