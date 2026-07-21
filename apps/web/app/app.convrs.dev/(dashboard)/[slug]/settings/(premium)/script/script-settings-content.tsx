"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Switch } from "@repo/ui";
import ScriptInstallationCard, {
  ScriptConfig,
} from "./script-installation-card";

export default function ScriptSettingsContent() {
  const { slug } = useParams() as { slug?: string };
  const [scriptConfig, setScriptConfig] = useState<ScriptConfig>({
    domain: null,
    projectToken: null,
  });

  useEffect(() => {
    if (!slug) return;

    fetch(`/api/workspaces/${slug}/script-config`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch workspace script config");
        }

        const data = (await res.json()) as ScriptConfig;
        setScriptConfig(data);
      })
      .catch(() => {
        setScriptConfig({ domain: null, projectToken: null });
      });
  }, [slug]);

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-5">
      <div className="bg-bg-default rounded-xl border border-border-subtle p-4 px-5 space-y-4">
        <ScriptInstallationCard
          scriptConfig={scriptConfig}
          allowLocalhostDebugging={enabled}
        />

        <div className="bg-bg-emphasis/65 rounded-xl p-3 ">
          <div className="flex items-center justify-between font-display text-content-default font-medium text-sm">
            <div>
              <h1>Allow Localhost debugging</h1>
              <h1 className="text-[13.5px] text-content-subtle">
                For development purposes only. Learn more.
              </h1>
            </div>
            <Switch
              disabled={loading}
              checked={enabled || false}
              trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-7 h-4"
              thumbDimensions="size-3.5"
              thumbTranslate="translate-x-3"
              fn={setEnabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
