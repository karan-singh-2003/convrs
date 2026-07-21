// apps/web/ui/workspaces/revenue/connected-state.tsx
"use client";
import { Button } from "@repo/ui";

export function ConnectedState({
  label,
  disconnecting,
  onDisconnect,
}: {
  label: string;
  disconnecting: boolean;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="font-display text-[14.5px] font-medium text-content-default">
        You have connected {label}
      </h2>
      <Button
        text="Disconnect"
        variant="danger"
        className="h-10 w-fit rounded-full px-5 text-[13px] font-display"
        onClick={onDisconnect}
        loading={disconnecting}
      />
    </div>
  );
}