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

export const POPPINS_FONT_FAMILY =
  "Poppins, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
export const ALEXANDRIA_FONT_FAMILY =
  "Alexandria, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";

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
          fontFamily="Poppins"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrJJfecg.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Poppins"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Poppins"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2",
            format: "woff2",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        <Font
          fontFamily="Alexandria"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/alexandria/v6/UMBXrPdDqW66y0Y2usFeai3dAw.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Alexandria"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/alexandria/v6/UMBXrPdDqW66y0Y2usFeai3dAw.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Alexandria"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/alexandria/v6/UMBXrPdDqW66y0Y2usFeai3dAw.woff2",
            format: "woff2",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>

      <Tailwind >
        <Body
          style={{ fontFamily: POPPINS_FONT_FAMILY }}
          className="bg-white font-display mx-auto my-0"
        >
          <Container className="mx-auto my-10 max-w-[600px] border border-neutral-200 px-10 py-6">
            <Logo />

            {children}

            <Section className="mt-10 border-t border-neutral-200 pt-6">
              <Text
                className="text-xs leading-6 text-neutral-500"
                style={{ fontFamily: POPPINS_FONT_FAMILY }}
              >
                This email was sent to{" "}
                <span style={{ color: "#000" }}>{email}</span>. If you weren’t
                expecting it, you can safely ignore it.
              </Text>

              <Text
                className="text-xs leading-6 text-neutral-500"
                style={{ fontFamily: POPPINS_FONT_FAMILY }}
              >
                © {new Date().getFullYear()} Convrs — Privacy First Analytics.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
