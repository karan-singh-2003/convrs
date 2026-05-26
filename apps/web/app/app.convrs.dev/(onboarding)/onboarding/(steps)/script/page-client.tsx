"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { codeToHtml } from "shiki";
import { Check } from "lucide-react";
import { Button } from "@repo/ui";
import { useOnboardingProgress } from "../../use-onboarding-progress";

type ScriptConfig = {
  domain: string | null;
  projectToken: string | null;
};

const buildScriptSnippet = ({
  domain,
  projectToken,
  loading,
}: ScriptConfig & { loading?: boolean }) => `<script 
  defer
  src="https://cdn.convrs.dev/script.js"
  data-domain="${
    loading && !domain ? "████████████████" : domain || "yourdomain.com"
  }"
  data-website-token="${
    loading && !projectToken
      ? "████████████████████"
      : projectToken || "your-project-token"
  }"
></script>`;

function CodeSnippet({ code, loading }: { code: string; loading?: boolean }) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    codeToHtml(code, {
      lang: "html",
      theme: "catppuccin-mocha",
    }).then((result) => {
      const highlighted = loading
        ? result
            .replaceAll(
              "████████████████████",
              `<span class="inline-block animate-pulse rounded bg-white/10 text-transparent select-none">████████████████████</span>`
            )
            .replaceAll(
              "████████████████",
              `<span class="inline-block animate-pulse rounded bg-white/10 text-transparent select-none">████████████████</span>`
            )
        : result;

      setHtml(highlighted);
    });
  }, [code, loading]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const { finish } = useOnboardingProgress();

  return (
    <div className="flex flex-col space-y-6">
      <div className="rounded-none border py-3 bg-black border-gray-200 overflow-hidden">
        <div className="flex items-center justify-end px-4 ">
          <button
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy script"}
            className="flex items-center text-xs text-gray-500 transition-colors hover:text-gray-800"
          >
            {copied ? (
              <Check className="size-4 text-white" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-3.5 text-white"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
                />
              </svg>
            )}
          </button>
        </div>

        <div className="px-4 pb-2">
          <pre className="overflow-x-auto text-sm text-white [&_.line::before]:hidden [&_.line::before]:content-none">
            <code
              className="space-y-1 font-mono"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </pre>
        </div>
      </div>
      <Button
        variant="secondary"
        text="I have installed the script"
        className="text-neutral-600 font-display w-fit mx-auto px-10"
        onClick={() => finish()}
      ></Button>
    </div>
  );
}

export default function ScriptSettingsPage() {
  const searchParams = useSearchParams();
  const workspace = searchParams.get("workspace");

  const [loading, setLoading] = useState(true);
  const [scriptConfig, setScriptConfig] = useState<ScriptConfig>({
    domain: null,
    projectToken: null,
  });

  useEffect(() => {
    if (!workspace) {
      setLoading(false);
      return;
    }

    setLoading(true);

    fetch(`/api/workspaces/${workspace}/script-config`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch workspace script config");
        }
        const data = (await res.json()) as ScriptConfig;
        setScriptConfig(data);
      })
      .catch(() => {
        setScriptConfig({ domain: null, projectToken: null });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspace]);

  return (
    <CodeSnippet
      loading={loading}
      code={buildScriptSnippet({
        ...scriptConfig,
        loading,
      })}
    />
  );
}
