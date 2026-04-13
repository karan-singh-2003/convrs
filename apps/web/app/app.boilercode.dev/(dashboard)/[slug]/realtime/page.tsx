import { ArrowRight } from "lucide-react";
import Globe, { type GlobeDataPoint } from "./globe";

export default function Dashboard() {
  const dataPoints: GlobeDataPoint[] = [
    { id: "berlin", latitude: 52.52, longitude: 13.405, value: 10 },
    { id: "london", latitude: 51.5072, longitude: -0.1276, value: 6 },
    { id: "new-york", latitude: 40.7128, longitude: -74.006, value: 8 },
  ];

  return (
    <div className="relative min-h-screen">
      <Globe dataPoints={dataPoints} />

      <div className="fixed inset-x-0 bottom-4 z-20 px-3">
        <div className="mx-auto w-full max-w-[25rem] overflow-hidden rounded-3xl border border-neutral-200/70 bg-neutral-100/90 shadow-[0_10px_40px_rgba(0,0,0,0.12)] backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-neutral-600">
            <p className="text-[16px] font-medium">
              • <span className="font-bricolageGrotesque">2</span> visitors on
              trustmrr.com
            </p>
            <p className="text-sm font-bricolageGrotesque">
              (est. value{" "}
              <span className="font-semibold text-emerald-600">$100</span>)
            </p>
          </div>

          {/* Content */}
          <div className="space-y-4 px-4 py-4">
            {/* Row */}
            <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
              <span className="text-sm font-display text-neutral-400">
                Referrers
              </span>
              <span className="text-base flex items-center gap-x-3 font-medium text-neutral-600">
                <ArrowRight size={15} /> Direct
              </span>
              <span className="text-sm font-bricolageGrotesque text-neutral-400">
                19
              </span>
            </div>

            {/* Row */}
            <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
              <span className="text-sm font-display text-neutral-400">
                Countries
              </span>
              <div className="flex items-center gap-2 text-base font-medium text-neutral-600">
                <span
                  className="h-5 w-5 rounded-full border border-neutral-300"
                  style={{
                    background:
                      "linear-gradient(to bottom, #000 0 33.33%, #dd0000 33.33% 66.66%, #ffce00 66.66% 100%)",
                  }}
                />
                <span>Germany</span>
              </div>
              <span className="text-sm font-bricolageGrotesque text-neutral-400">
                10
              </span>
            </div>

            {/* Row */}
            <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
              <span className="text-sm font-display text-neutral-400">
                Pages
              </span>
              <span className="text-base font-medium text-neutral-600">/</span>
              <span className="text-sm font-bricolageGrotesque text-neutral-400">
                3
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
