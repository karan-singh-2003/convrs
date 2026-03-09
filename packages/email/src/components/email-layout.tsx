import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Tailwind,
  Section,
  Text,
} from "@react-email/components";
import { Font } from "@react-email/font";
import React from "react";
import Logo from "./Logo";

export default function EmailLayout({
  preview,
  children,
  email,
}: {
  preview: string;
  children: React.ReactNode;
  email: string;
}) {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTcviYwY.woff2",
            format: "woff2",
          }}
        />
        <Font
          fontFamily="Google Sans"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/googlesans/v29/4UasrENHsxJlGDuGo1OIlJfC6mGS6vF2.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>

      <Tailwind >
        <Body
          style={{
            fontFamily:
              "Google Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif",
          }}
          className="bg-white font-display mx-auto my-0"
        >
          <Container className="mx-auto my-10 max-w-[600px] border border-neutral-200 px-10 py-6">
            <Logo />

            {children}

            <Section className="mt-10 border-t border-neutral-200 pt-6">
              <Text
                className="text-xs leading-6 text-neutral-500"
                style={{
                  fontFamily:
                    "Google Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif",
                }}
              >
                This email was sent to{" "}
                <span style={{ color: "#000" }}>{email}</span>. If you weren’t
                expecting it, you can safely ignore it.
              </Text>

              <Text
                className="text-xs leading-6 text-neutral-500"
                style={{
                  fontFamily:
                    "Google Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif",
                }}
              >
                © {new Date().getFullYear()} Boilercode.dev — Production-ready
                SaaS boilerplates.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
