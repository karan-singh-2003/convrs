"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Switch } from "@repo/ui";
import ScriptInstallationCard, {
  ScriptConfig,
} from "./script-installation-card";

// script-settings-content.tsx
export default function ScriptSettingsContent() {
  const { slug } = useParams() as { slug?: string };
  const [scriptConfig, setScriptConfig] = useState<ScriptConfig>({
    domain: null,
    projectToken: null,
    cookielessMode: false,
  });

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/workspaces/${slug}/script-config`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch workspace script config");
        const data = (await res.json()) as ScriptConfig;
        setScriptConfig(data);
      })
      .catch(() => {
        setScriptConfig({ domain: null, projectToken: null, cookielessMode: false });
      });
  }, [slug]);

  const [enabled, setEnabled] = useState(false); // localhost debugging, unchanged
  const [loading, setLoading] = useState(false);
  const [cookielessToggling, setCookielessToggling] = useState(false);

  const toggleCookieless = async (checked: boolean) => {
    if (!slug) return;
    setCookielessToggling(true);
    setScriptConfig((prev) => ({ ...prev, cookielessMode: checked })); // optimistic
    try {
      const res = await fetch(`/api/workspaces/${slug}/script-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookielessMode: checked }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = (await res.json()) as ScriptConfig;
      setScriptConfig(data);
    } catch {
      setScriptConfig((prev) => ({ ...prev, cookielessMode: !checked })); // revert on failure
    } finally {
      setCookielessToggling(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-bg-default rounded-xl border border-border-subtle p-4 px-5 space-y-4">
        <ScriptInstallationCard
          scriptConfig={scriptConfig}
          allowLocalhostDebugging={enabled}
        />

        <div className="bg-bg-card border border-border-subtle rounded-xl p-3">
          <div className="flex items-center justify-between font-display text-content-default font-medium text-sm">
            <div>
              <h1>Cookieless / Privacy mode</h1>
              <h1 className="text-[13.5px] text-content-subtle">
                Track visitors without cookies. Lower long-term accuracy, no cross-domain tracking. Learn more.
              </h1>
            </div>
            <Switch
              disabled={cookielessToggling}
              checked={scriptConfig.cookielessMode}
              trackDimensions=" w-7 h-4"
              thumbDimensions="size-3.5"
              thumbTranslate="translate-x-3"
              fn={toggleCookieless}
            />
          </div>
        </div>

        <div className="bg-bg-card border-border-subtle rounded-xl p-3">
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
              trackDimensions=" w-7 h-4"
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
