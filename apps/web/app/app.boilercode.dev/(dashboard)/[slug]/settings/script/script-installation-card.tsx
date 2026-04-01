"use client";

import { useMemo, useState } from "react";
import { ToggleGroup } from "@repo/ui";
import CodeSnippet from "./code-snippet";

export type ScriptConfig = {
  domain: string | null;
  projectToken: string | null;
};

const buildScriptSnippet = ({ domain, projectToken }: ScriptConfig) =>
  `<script\n  defer\n  src=\"https://www.dubcdn.com/analytics/script.js\"\n  data-domain=\"${domain || "yourdomain.com"}\"\n  data-website-token=\"${projectToken || "your-project-token"}\"\n></script>`;

const buildNpmInitSnippet = ({ projectToken }: ScriptConfig) =>
  `import { initSignal } from \"signal\";\n\nconst signal = await initSignal({\n  websiteId: \"${projectToken || "your-project-token"}\",\n});`;

export default function ScriptInstallationCard({
  scriptConfig,
}: {
  scriptConfig: ScriptConfig;
}) {
  const [mode, setMode] = useState<"script" | "npm">("script");

  const scriptSnippet = useMemo(
    () => buildScriptSnippet(scriptConfig),
    [scriptConfig]
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
            { value: "script", label: "Script" },
            { value: "npm", label: "npm" },
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
              Install the Signal package and initialize it with your project
              token. Use it in React, Next.js, or any JavaScript app. See our
              npm docs for details.
            </h1>
          </div>

          <div className="space-y-2">
            <p className="font-display text-sm font-medium text-gray-600">
              1. Install the package
            </p>
            <CodeSnippet
              code="npm i signal"
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
