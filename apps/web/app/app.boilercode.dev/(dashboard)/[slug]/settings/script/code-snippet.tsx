"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { Check } from "lucide-react";

type CodeSnippetProps = {
  code: string;
  lang: "html" | "bash" | "tsx";
  ariaLabel?: string;
};

export default function CodeSnippet({
  code,
  lang,
  ariaLabel = "Copy code",
}: CodeSnippetProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    codeToHtml(code, {
      lang,
      theme: "min-light"
    }).then(setHtml);
  }, [code, lang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-xl bg-white py-3 pb-3 overflow-hidden">
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={handleCopy}
          aria-label={copied ? "Copied" : ariaLabel}
          className="flex items-center justify-center size-7 rounded-md bg-white/10 backdrop-blur text-white hover:bg-white/20 transition"
        >
          {copied ? (
            <Check className="size-4 text-green-400" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-4 text-white"
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

      <div
        className="text-sm overflow-x-auto [&>pre]:m-0 [&>pre]:px-4 [&_.line::before]:hidden [&_.line::before]:content-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
