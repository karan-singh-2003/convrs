"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { Check, Copy } from "lucide-react";
import { useTheme } from "next-themes";

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
  const [html, setHtml] = useState("");
  const [copied, setCopied] = useState(false);

  const { resolvedTheme } = useTheme();

  useEffect(() => {
    codeToHtml(code, {
      lang,
      theme: resolvedTheme === "dark" ? "github-dark" : "min-light",
    }).then(setHtml);
  }, [code, lang, resolvedTheme]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-default">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle bg-bg-card px-4 py-2">
        <span className="fontdisplay text-[13px] uppercase tracking-wide text-content-subtle">
          {lang}
        </span>

        <button
          onClick={handleCopy}
          aria-label={copied ? "Copied" : ariaLabel}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-content-subtle transition-colors hover:bg-bg-subtle hover:text-content-default"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div
        className="overflow-x-auto text-sm
          [&>pre]:m-0
          [&>pre]:bg-transparent
          [&>pre]:px-4
          [&>pre]:py-4
          [&_.line::before]:hidden
          [&_.line::before]:content-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}