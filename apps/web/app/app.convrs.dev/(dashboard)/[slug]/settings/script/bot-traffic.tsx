"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button, Switch } from "@repo/ui";
import { toast } from "sonner";
import useWorkspace from "@/lib/swr/use-workspace";
import CodeSnippet from "./code-snippet";

type BotTrafficState = {
  requireAuth: boolean;
  token: { partialKey: string; createdAt: string } | null;
  rawToken?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const snippet = (websiteId: string) => `// proxy.ts (or middleware.ts)
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { trackAICrawlerRequest } from "@convrs/ai-bot-sdk";

export function proxy(request: NextRequest, event: NextFetchEvent) {
  // Do not await: tracking runs in the background via event.waitUntil.
  trackAICrawlerRequest(request, event, {
    websiteId: "${websiteId}",
  });
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};`;

export function BotTraffic({ projectToken }: { projectToken: string | null }) {
  const { id: workspaceId } = useWorkspace();
  const url = workspaceId ? `/api/workspaces/${workspaceId}/bot-traffic` : null;
  const { data, mutate } = useSWR<BotTrafficState>(url, fetcher);
  const [busy, setBusy] = useState(false);
  const [rawToken, setRawToken] = useState<string | null>(null);

  const call = async (method: "POST" | "DELETE" | "PATCH", body?: unknown) => {
    if (!url) return;
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await res.json()) as BotTrafficState & { error?: string };
      if (!res.ok) throw new Error(result.error || "Request failed");
      setRawToken(result.rawToken ?? null);
      mutate({ requireAuth: result.requireAuth, token: result.token }, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-bg-card rounded-xl border border-border-subtle p-4 px-5 space-y-4">
      <div className="font-display text-sm">
        <h2 className="font-medium text-content-default">Bot traffic (AI crawlers)</h2>
        <p className="text-[13.5px] text-content-subtle">
          AI and search crawlers usually don&apos;t run JavaScript. Track them server-side with{" "}
          <code>@convrs/ai-bot-sdk</code> and your public website ID; Convrs classifies and verifies
          every request. Bot traffic has its own daily allowance and never uses your event quota.
        </p>
      </div>

      <CodeSnippet lang="tsx" code={snippet(projectToken || "your-project-token")} />

      <div className="rounded-xl border border-border-subtle p-3 space-y-3 font-display text-sm">
        <div>
          <h3 className="font-medium text-content-default">Optional: bot traffic token</h3>
          <p className="text-[13px] text-content-subtle">
            Not needed to get started. Adding it to the snippet as{" "}
            <code>authToken: process.env.CONVRS_BOT_TOKEN</code> marks events as authenticated, and lets
            you reject events that don&apos;t carry it. Keep it in a server-side environment variable,
            never in browser code.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-content-subtle truncate">
              {data?.token ? data.token.partialKey : "No token yet."}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              text={data?.token ? "Rotate" : "Generate"}
              loading={busy}
              onClick={() => call("POST")}
              className="h-8 px-3 rounded-full w-fit text-[13px]"
            />
            {data?.token && (
              <Button
                type="button"
                variant="secondary"
                text="Delete"
                disabled={busy}
                onClick={() => call("DELETE")}
                className="h-8 px-3 rounded-full w-fit text-[13px]"
              />
            )}
          </div>
        </div>

        {rawToken && (
          <div className="space-y-1">
            <p className="text-[13px] text-content-subtle">
              Copy this token now — it won&apos;t be shown again. Rotating disables the previous token.
            </p>
            <CodeSnippet lang="bash" code={`CONVRS_BOT_TOKEN=${rawToken}`} ariaLabel="Copy bot token" />
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-content-default">Reject unauthenticated requests</h3>
            <p className="text-[13px] text-content-subtle">
              Only accept bot-traffic events that carry this website&apos;s token. Requires a token.
            </p>
          </div>
          <Switch
            disabled={busy || !data}
            checked={data?.requireAuth ?? false}
            trackDimensions="radix-state-checked:bg-neutral-900 dark:radix-state-checked:bg-neutral-100 w-8 h-5"
            thumbTranslate="translate-x-3"
            fn={(checked: boolean) => call("PATCH", { requireAuth: checked })}
          />
        </div>
      </div>
    </div>
  );
}
