import { Column, Row, Section, Text } from "@react-email/components";
import React from "react";

// Duplicated from email-layout.tsx rather than imported, to avoid a
// circular import (email-layout renders this component).
const POPPINS_FONT_FAMILY =
  "Poppins, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";

export default function Logo() {
  return (
    <Section className="mb-6">
      <Row>
        <Column style={{ width: 32 }}>
          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            style={{ width: 32, height: 32 }}
          >
            <tbody>
              <tr>
                <td
                  align="center"
                  valign="middle"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "#000",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 102 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M32.776 48.248C32.776 44.984 33.528 42.056 35.032 39.464C36.568 36.872 38.632 34.856 41.224 33.416C43.848 31.944 46.712 31.208 49.816 31.208C53.368 31.208 56.52 32.088 59.272 33.848C62.056 35.576 64.072 38.04 65.32 41.24H58.744C57.88 39.48 56.68 38.168 55.144 37.304C53.608 36.44 51.832 36.008 49.816 36.008C47.608 36.008 45.64 36.504 43.912 37.496C42.184 38.488 40.824 39.912 39.832 41.768C38.872 43.624 38.392 45.784 38.392 48.248C38.392 50.712 38.872 52.872 39.832 54.728C40.824 56.584 42.184 58.024 43.912 59.048C45.64 60.04 47.608 60.536 49.816 60.536C51.832 60.536 53.608 60.104 55.144 59.24C56.68 58.376 57.88 57.064 58.744 55.304H65.32C64.072 58.504 62.056 60.968 59.272 62.696C56.52 64.424 53.368 65.288 49.816 65.288C46.68 65.288 43.816 64.568 41.224 63.128C38.632 61.656 36.568 59.624 35.032 57.032C33.528 54.44 32.776 51.512 32.776 48.248Z"
                      fill="white"
                    />
                  </svg>
                </td>
              </tr>
            </tbody>
          </table>
        </Column>
        <Column style={{ paddingLeft: 8, verticalAlign: "middle" }}>
          <Text
            className="m-0 text-[14px] font-semibold text-black"
            style={{ fontFamily: POPPINS_FONT_FAMILY }}
          >
            Convrs Analytics
          </Text>
        </Column>
      </Row>
    </Section>
  );
}
