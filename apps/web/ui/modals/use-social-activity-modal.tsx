
"use client";

import { Modal } from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@repo/utils";
import { useParams } from "next/navigation";

type ActivityItem = {
  id: string;
  kind: "attribution" | "mention";
  platform: "x" | "reddit";
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  content: string | null;
  postUrl: string | null;
  profileUrl: string;
  likeCount: number;
  replyCount: number;
  confidence?: "high" | "medium" | "low";
  matchMethod?: "exact_url" | "fuzzy_url" | "link_in_bio";
  visitorCount?: number;
};

function kindBadge(item: ActivityItem) {
  if (item.kind === "mention") return "Mentioned you";
  if (item.matchMethod === "link_in_bio") return "Bio link traffic";
  return "Drove traffic";
}

function confidenceLabel(confidence?: ActivityItem["confidence"]) {
  if (!confidence) return null;
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Possible match";
  return "Low confidence";
}

function openProfile(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function SocialActivityModal({
  showModal,
  setShowModal,
  dateKey,
  dateLabel,
}: {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  dateKey: string | null;
  dateLabel: string | null;
}) {
  const { slug } = useParams() as { slug?: string };

  const { data, isLoading } = useSWR<{ data: ActivityItem[] }>(
    showModal && dateKey && slug ? `/api/${slug}/social/activity?date=${dateKey}` : null,
    fetcher
  );

  const items = data?.data ?? [];

  return (
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      className="px-4 py-3 md:px-0 md:py-1.5 max-h-[90vh] md:max-h-[95dvh] md:overflow-y-auto"
    >
      <div className="space-y-1 md:py-1 md:border-b md:border-border-subtle">
        <h3 className="text-[16px] md:text-[17.5px] md:px-5 font-display font-medium text-content-default">
          Social activity{dateLabel ? ` — ${dateLabel}` : ""}
        </h3>
      </div>

      <div className="md:py-4 md:px-5 space-y-3 max-h-[60vh] overflow-y-auto">
        {isLoading && (
          <p className="text-[13px] text-content-subtle font-display py-6 text-center">
            Loading…
          </p>
        )}

        {!isLoading && items.length === 0 && (
          <p className="text-[13px] text-content-subtle font-display py-6 text-center">
            No social activity found for this day.
          </p>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-border-subtle p-3"
          >
            <button type="button" onClick={() => openProfile(item.profileUrl)} className="shrink-0">
              <img
                src={item.avatarUrl ?? undefined}
                alt={item.handle}
                className="size-9 rounded-full bg-bg-subtle"
              />
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openProfile(item.profileUrl)}
                  className="text-[13.5px] font-medium font-display text-content-default hover:underline truncate"
                >
                  {item.displayName || `@${item.handle}`}
                  <span className="ml-1 font-normal text-content-subtle">@{item.handle}</span>
                </button>
                <span className="shrink-0 text-[11px] text-content-subtle font-display uppercase">
                  {item.platform}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[11px] font-medium text-content-default">
                  {kindBadge(item)}
                </span>
                {confidenceLabel(item.confidence) && (
                  <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[11px] text-content-subtle">
                    {confidenceLabel(item.confidence)}
                  </span>
                )}
              </div>

              {item.content ? (
                <p className="text-[13.5px] font-display text-content-default whitespace-pre-wrap">
                  {item.content}
                </p>
              ) : (
                <p className="text-[13px] font-display text-content-subtle italic">
                  Traffic from this account's bio link — no specific post.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-content-subtle font-display pt-1">
                {item.kind === "mention" && (
                  <>
                    <span>{item.likeCount} likes</span>
                    <span>{item.replyCount} replies</span>
                  </>
                )}
                {item.kind === "attribution" && item.visitorCount !== undefined && (
                  <span className="font-medium text-content-default">
                    {item.visitorCount} visitor{item.visitorCount === 1 ? "" : "s"}
                  </span>
                )}
                {item.postUrl && (
                  <a
                    href={item.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto font-medium text-content-default hover:underline"
                  >
                    Open →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function useSocialActivityModal() {
  const [showModal, setShowModal] = useState(false);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState<string | null>(null);

  const openActivityModal = useCallback((key: string, label?: string) => {
    setDateKey(key);
    setDateLabel(label ?? key);
    setShowModal(true);
  }, []);

  const SocialActivityModalCallback = useCallback(() => {
    return (
      <SocialActivityModal
        showModal={showModal}
        setShowModal={setShowModal}
        dateKey={dateKey}
        dateLabel={dateLabel}
      />
    );
  }, [showModal, dateKey, dateLabel]);

  return useMemo(
    () => ({
      openActivityModal,
      SocialActivityModal: SocialActivityModalCallback,
    }),
    [openActivityModal, SocialActivityModalCallback]
  );
}