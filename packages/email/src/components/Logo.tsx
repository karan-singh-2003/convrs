import { Section } from "@react-email/components";
import React from "react";

export default function Logo() {
  return (
    <Section className="mb-6">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 182 199"
        fill="none"
      >
        <path
          d="M0 50.837L90.3333 0L182 50.837V148.832L90.3333 199L0 148.832V50.837Z"
          fill="#363636"
        />
        <path
          d="M10 50.0038L90.1639 5L173 49.6679L90.832 94L10 50.0038Z"
          fill="white"
        />
      </svg>
    </Section>
  );
}