"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { fetcher } from "@repo/utils";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import useWorkspace from "@/lib/swr/use-workspace";
import { AnimatedSizeContainer, Button } from "@repo/ui";
import { Loader2 } from "lucide-react";

type UploadStatus =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "success"; rowsImported: number }
  | { state: "error"; message: string };

type PlausibleStatus = { connected: boolean; events: number };

function PlausibleImportCard({ workspaceIdOrSlug }: { workspaceIdOrSlug: string }) {
  const endpoint = `/api/workspaces/${workspaceIdOrSlug}/import/plausible`;
  const { mutate: globalMutate } = useSWRConfig();

  const { data: status, mutate: mutateStatus } = useSWR<PlausibleStatus>(
    workspaceIdOrSlug ? endpoint : null,
    fetcher
  );

  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadStatus>({ state: "idle" });
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const connected = status?.connected ?? false;

  // Revalidate every dashboard query so imported (or removed) traffic shows
  // up / disappears without a hard refresh.
  const refreshAnalytics = () =>
    globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/analytics"),
      undefined,
      { revalidate: true }
    );

  async function handleImport() {
    if (!file) return;
    setUpload({ state: "uploading" });

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res
        .json()
        .catch(() => null as null | Record<string, unknown>);

      if (!res.ok || !data || !data.success) {
        const message =
          (data && typeof data.error === "string" && data.error) ||
          (res.status === 413
            ? "That export is too large. Split it into a shorter date range and import each part."
            : res.status === 504
              ? "The import timed out. Try importing a shorter date range at a time."
              : `Import failed (HTTP ${res.status}).`);
        setUpload({ state: "error", message });
        return;
      }

      const rowsImported = Number(data.rowsImported) || 0;
      setUpload({ state: "success", rowsImported });
      setFile(null);
      // Rows land in Tinybird async, so the count query can lag a few seconds —
      // show the connected state optimistically, then reconcile.
      await mutateStatus(
        { connected: true, events: (status?.events ?? 0) + rowsImported },
        { revalidate: false }
      );
      setTimeout(() => mutateStatus(), 6000);
      refreshAnalytics();
    } catch (err) {
      setUpload({
        state: "error",
        message: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json().catch(() => null as any);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "Failed to remove imported data");
      }
      toast.success(
        data.removed
          ? `Removed ${Number(data.removed).toLocaleString()} imported events`
          : "Plausible data removed"
      );
      setConfirmingRemove(false);
      setUpload({ state: "idle" });
      await mutateStatus({ connected: false, events: 0 }, { revalidate: false });
      setTimeout(() => mutateStatus(), 6000);
      refreshAnalytics();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove imported data"
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <div className="w-full space-y-3">
        <div className="space-y-0.5">
          <h2 className="font-display text-sm font-medium text-content-default">
            Import from Plausible
          </h2>
          <p className="font-display text-[13.5px] text-content-subtle">
            Upload a Plausible export ZIP below — either the dashboard{" "}
            <span className="font-medium">Export to CSV</span> download or the
            full <span className="font-medium">Settings → Imports &amp; Exports</span>{" "}
            export. Both formats are supported.
          </p>
        </div>

        {/* ── Connected state ───────────────────────────────────────────── */}
        {connected && (
          <div className="space-y-3 rounded-xl border border-border-subtle bg-bg-subtle p-4 font-display">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13.5px] font-medium text-content-default">
                  Plausible connected
                </p>
                <p className="text-xs text-content-subtle">
                  {status!.events.toLocaleString()} imported events in your
                  analytics.
                </p>
              </div>

              {!confirmingRemove && (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  className="shrink-0 rounded-lg border border-border-subtle px-3 py-1.5 text-[13px] font-medium text-content-default transition-colors hover:bg-bg-emphasis"
                >
                  Disconnect Plausible
                </button>
              )}
            </div>

            {confirmingRemove && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/30">
                <p className="text-xs text-red-700 dark:text-red-300">
                  This permanently removes all{" "}
                  {status!.events.toLocaleString()} Plausible-imported events
                  from this workspace's analytics. It can't be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={removing}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {removing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {removing ? "Removing…" : "Remove imported data"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(false)}
                    disabled={removing}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-content-subtle transition-colors hover:bg-bg-emphasis"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Upload form (always available — import more ranges) ────────── */}
        <label className="flex h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-subtle px-2 pl-4 transition hover:bg-bg-emphasis">
          <span className="flex-1 truncate font-display text-[13.5px] text-content-subtle">
            {file ? file.name : "No file selected"}
          </span>
          <span className="shrink-0 rounded-md bg-bg-emphasis px-4 py-1.5 font-display text-[13.5px] font-medium text-content-default">
            Choose file
          </span>
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setUpload({ state: "idle" });
            }}
          />
        </label>

        <Button
          type="button"
          variant="settings"
          disabled={!file || upload.state === "uploading"}
          onClick={handleImport}
          text={
            upload.state === "uploading"
              ? "Importing…"
              : connected
                ? "Import another export"
                : "Import data"
          }
          className="rounded-xl font-display"
        />

        {upload.state === "success" && (
          <p className="font-display text-xs text-green-600">
            Import complete — {upload.rowsImported.toLocaleString()} analytics
            events added. Historical data may take a minute to finish processing.
          </p>
        )}
        {upload.state === "error" && (
          <p className="font-display text-xs text-red-600">{upload.message}</p>
        )}

        <p className="font-display text-xs text-content-subtle">
          Only ZIP exports generated by Plausible are supported. Numbers are
          reconstructed from Plausible's daily aggregates, so per-visitor
          filtering across dimensions is approximate.
        </p>
      </div>
    </div>
  );
}

export default function Import() {
  const { id: workspaceId, slug } = useWorkspace();
  const workspaceIdOrSlug = slug ?? workspaceId ?? "";

  return (
    <PageWidthWrapper>
      <AnimatedSizeContainer height>
        <SettingsChildrenLayout
          title="Import"
          description="Bring historical data into Convrs."
        >
          <div className="space-y-5">
            {workspaceIdOrSlug && (
              <PlausibleImportCard workspaceIdOrSlug={workspaceIdOrSlug} />
            )}
          </div>
        </SettingsChildrenLayout>
      </AnimatedSizeContainer>
    </PageWidthWrapper>
  );
}
