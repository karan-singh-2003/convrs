"use client";

import { useMemo, useState } from "react";
import { ToggleGroup } from "@repo/ui";
import CodeSnippet from "./code-snippet";

export type ScriptConfig = {
  domain: string | null;
  projectToken: string | null;
};

type ScriptSnippetConfig = ScriptConfig & { allowLocalhostDebugging: boolean };

const buildScriptSnippet = ({
  domain,
  projectToken,
  allowLocalhostDebugging,
}: ScriptSnippetConfig) => {
  const snippetDomain = allowLocalhostDebugging
    ? "localhost"
    : domain || "yourdomain.com";

  const lines = [
    "<Script",
    `  data-website-id=\"${projectToken || "your-project-token"}\"`,
    '  src="https://cdn.karanbuilds.me/analytics.js"',
    `  data-domain=\"${snippetDomain}\"`,
  ];

  if (allowLocalhostDebugging) {
    lines.push(
      '  data-debug="true"',
      '  data-allow-localhost="true"',
      '  data-api="http://localhost:3000/api/track"'
    );
  }

  lines.push("/>");
  return lines.join("\n");
};

const buildNpmInitSnippet = ({ projectToken }: ScriptConfig) =>
  `import { initDataFast } from '@karanbuilds/analytics-sdk';\n\nlet analyticsPromise: ReturnType<typeof initDataFast> | null = null;\n\nexport function getAnalytics() {\n  const hasCrossDomainParams =\n    typeof window !== 'undefined' &&\n    (window.location.search.includes('_df_vid') ||\n     window.location.search.includes('_df_sid'));\n\n  if (!analyticsPromise || hasCrossDomainParams) {\n    analyticsPromise = initDataFast({\n      websiteId: \"${projectToken || "your-project-token"}\",\n      domain: typeof window !== \"undefined\" ? window.location.host : \"localhost\",\n      autoCapturePageviews: true,\n      apiUrl: \"http://localhost:3000/api/track\",\n      allowLocalhost: true,\n      debug: true,\n    });\n  }\n  return analyticsPromise;\n}`;

export default function ScriptInstallationCard({
  scriptConfig,
  allowLocalhostDebugging,
}: {
  scriptConfig: ScriptConfig;
  allowLocalhostDebugging: boolean;
}) {
  const [mode, setMode] = useState<"script" | "npm">("script");

  const scriptSnippet = useMemo(
    () => buildScriptSnippet({ ...scriptConfig, allowLocalhostDebugging }),
    [scriptConfig, allowLocalhostDebugging]
  );

  const npmInitSnippet = useMemo(
    () => buildNpmInitSnippet(scriptConfig),
    [scriptConfig]
  );

  return (
    <div className="bg-neutral-100 p-3 rounded-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        {/* <p className="font-display font-medium text-sm text-gray-500">
          Install Signal analytics using a script tag or the npm SDK.
        </p> */}

        <ToggleGroup
          selected={mode}
          selectAction={(option) => setMode(option as "script" | "npm")}
          options={[
            {
              value: "script",
              label: (
                <span className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="size-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
                    />
                  </svg>
                  Script Tag
                </span>
              ),
            },
            {
              value: "npm",
              label: (
                <span className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    id="Npm-Icon--Streamline-Svg-Logos"
                    height="16"
                    width="16"
                  >
                    <desc>
                      Npm Icon Streamline Icon: https://streamlinehq.com
                    </desc>
                    <path
                      fill="#c12127"
                      d="M0.25 23.75V0.25h23.5v23.5H0.25Z"
                      strokeWidth="0.25"
                    ></path>
                    <path
                      fill="#ffffff"
                      d="M4.65625 4.65625h14.6875v14.6875h-2.9375v-11.75H12v11.75H4.65625v-14.6875Z"
                      strokeWidth="0.25"
                    ></path>
                  </svg>
                  npm
                </span>
              ),
            },
          ]}
          className="bg-neutral-100 w-full text-center border border-neutral-200"
          optionClassName="w-full px-3 py-1 text-center text-sm justify-center"
        />
      </div>

      {mode === "script" ? (
        <>
          <p className="font-display text-sm text-gray-500">
            Add this to the{" "}
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">
              &lt;head&gt;
            </code>{" "}
            of your website.If you need more help see our installation guides .
            If you need to customize the script tag, you can learn more about
            the available options in our documentation.
          </p>
          <CodeSnippet
            code={scriptSnippet}
            lang="html"
            ariaLabel="Copy script snippet"
          />
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <h1 className="font-medium font-default text-[13.5px] text-neutral-600">
              Install the analytics SDK and initialize it with your project
              token. Use it in React, Next.js, or any JavaScript app. See our
              npm docs for details.
            </h1>
          </div>

          <div className="space-y-2">
            <p className="font-display text-sm font-medium text-gray-600">
              1. Install the package
            </p>
            <CodeSnippet
              code="npm i @karanbuilds/analytics-sdk"
              lang="bash"
              ariaLabel="Copy npm install command"
            />
          </div>

          <div className="space-y-2">
            <p className="font-display text-sm font-medium text-gray-600">
              2. Initialize with your website token
            </p>
            <CodeSnippet
              code={npmInitSnippet}
              lang="tsx"
              ariaLabel="Copy npm init code"
            />
          </div>
        </div>
      )}
    </div>
  );
}
