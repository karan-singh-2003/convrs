"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, ChevronRight, ChevronLeft } from "lucide-react";
import Globe, { type GlobeDataPoint } from "./globe";
import { BarList } from "@/ui/analytics/bar-list";
import useWorkspace from "@/lib/swr/use-workspace";
import { useLiveVisitors } from "@/lib/analytics/use-live-visitors";

type DashboardData = {
  total: number;
  referrers: { source: string; count: number }[];
  countries: { country: string; code: string; count: number }[];
  pages: { page: string; count: number }[];
  globe: GlobeDataPoint[];
};

type SectionKey = "referrers" | "countries" | "pages";

function getFlagStyle(code: string): string {
  const styles: Record<string, string> = {
    DE: "linear-gradient(to bottom, #000 0 33.33%, #dd0000 33.33% 66.66%, #ffce00 66.66% 100%)",
    IN: "linear-gradient(to bottom, #ff9933 0 33.33%, #fff 33.33% 66.66%, #138808 66.66% 100%)",
    US: "linear-gradient(to bottom, #b22234 0 50%, #fff 50% 100%)",
  };
  return (
    styles[code.toUpperCase()] ?? "linear-gradient(to bottom, #e5e7eb, #d1d5db)"
  );
}

// ─── Slide Panel ─────────────────────────────────────────────────────────────
// visible=true  → in place (opacity-100, translate-x-0)
// visible=false → slides toward `direction` and fades out
function SlidePanel({
  visible,
  direction,
  children,
  panelRef,
}: {
  visible: boolean;
  direction: "left" | "right" | "up" | "down";
  children: ReactNode;
  panelRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const hiddenTranslate =
    direction === "right"
      ? "translate-x-full"
      : direction === "left"
        ? "-translate-x-full"
        : direction === "down"
          ? "translate-y-6"
          : "-translate-y-6";

  return (
    <div
      ref={panelRef}
      className={[
        "absolute top-0 left-0 w-full transition-[opacity,transform] duration-300 ease-in-out",
        visible
          ? "opacity-100 translate-x-0 translate-y-0 pointer-events-auto"
          : `opacity-0 ${hiddenTranslate} pointer-events-none`,
      ].join(" ")}
      aria-hidden={!visible ? "true" : undefined}
    >
      {children}
    </div>
  );
}

function AnimatedCardBody({
  activeSection,
  summaryContent,
  detailContent,
}: {
  activeSection: SectionKey | null;
  summaryContent: ReactNode;
  detailContent: ReactNode;
}) {
  const isSummary = activeSection === null;
  const summaryRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const activeRef = isSummary ? summaryRef : detailRef;
    if (activeRef.current) {
      setHeight(activeRef.current.scrollHeight);
    }
  }, [isSummary, activeSection]);

  return (
    <div
      className="relative overflow-hidden transition-[height] duration-300 ease-in-out"
      style={{ height: height === undefined ? "auto" : height }}
    >
      <SlidePanel visible={isSummary} direction="down" panelRef={summaryRef}>
        {summaryContent}
      </SlidePanel>
      <SlidePanel visible={!isSummary} direction="up" panelRef={detailRef}>
        {detailContent}
      </SlidePanel>
    </div>
  );
}

// ─── Detail View ─────────────────────────────────────────────────────────────
function DetailView({
  title,
  onBack,
  barData,
  maxValue,
}: {
  title: string;
  onBack: () => void;
  barData: { label: string; value: number }[];
  maxValue: number;
}) {
  const mappedBarData = useMemo(
    () => barData.map((item) => ({ title: item.label, value: item.value })),
    [barData]
  );

  return (
    <div className="py-3">
      <div className="flex items-center mb-5 px-2 justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-neutral-200 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft size={16} className="text-neutral-500" />
        </button>
        <h1 className="font-medium text-neutral-600 text-[15px] text-center">
          {title}
        </h1>
        {/* Spacer to balance the back chevron so title is truly centred */}
        <div className="w-7" />
      </div>

      <div className="max-h-[200px] overflow-y-auto overflow-x-hidden scrollbar-hide">
        <BarList
          tab={title.toLowerCase()}
          unit="visitors"
          data={mappedBarData}
          allData={mappedBarData}
          maxValue={maxValue}
          barBackground="bg-neutral-200"
          hoverBackground="hover:bg-neutral-100"
          setShowModal={() => {}}
          limit={100}
        />
      </div>
    </div>
  );
}

// ─── Summary Row ─────────────────────────────────────────────────────────────
function SummaryRow({
  label,
  renderValue,
  count,
  onExpand,
}: {
  label: string;
  renderValue: () => ReactNode;
  count: number;
  onExpand: () => void;
}) {
  return (
    <div className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
      <span className="text-[15px] font-display text-neutral-500">{label}</span>
      {renderValue()}
      <button
        type="button"
        onClick={onExpand}
        className="flex items-center gap-1 text-sm font-bricolageGrotesque text-neutral-400 hover:text-neutral-600 transition-colors"
        aria-label={`Expand ${label}`}
      >
        <span>{count}</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const { id: workspaceId } = useWorkspace();
  const {
    count: liveCount,
    pages: livePages,
    points: livePoints,
  } = useLiveVisitors(workspaceId ?? null);

  const globeDataPoints = useMemo<GlobeDataPoint[]>(
    () =>
      livePoints.map((point, index) => ({
        id: point.id ?? `live-point-${index}`,
        latitude: point.latitude,
        longitude: point.longitude,
        value: point.value,
      })),
    [livePoints]
  );

  const handleExpand = useCallback(
    (key: SectionKey) => setActiveSection(key),
    []
  );
  const handleBack = useCallback(() => setActiveSection(null), []);

  const dashboardData = useMemo<DashboardData>(() => {
    const pages = livePages.map((item) => ({
      page: item.page,
      count: item.count,
    }));

    return {
      total: liveCount,
      referrers: [{ source: "No data", count: 0 }],
      countries: [{ country: "No data", code: "US", count: 0 }],
      pages,
      globe: globeDataPoints,
    };
  }, [liveCount, livePages, globeDataPoints]);

  const hasLiveData = liveCount > 0 || livePages.length > 0;

  useEffect(() => {
    if (!hasLiveData && activeSection !== null) {
      setActiveSection(null);
    }
  }, [hasLiveData, activeSection]);

  const referrerBarData = useMemo(
    () =>
      dashboardData.referrers.map((item) => ({
        label: item.source,
        value: item.count,
      })),
    [dashboardData.referrers]
  );
  const countryBarData = useMemo(
    () =>
      dashboardData.countries.map((item) => ({
        label: item.country,
        value: item.count,
      })),
    [dashboardData.countries]
  );
  const pageBarData = useMemo(
    () =>
      dashboardData.pages.map((item) => ({
        label: item.page,
        value: item.count,
      })),
    [dashboardData.pages]
  );

  const referrerMax = useMemo(
    () => Math.max(...referrerBarData.map((d) => d.value), 1),
    [referrerBarData]
  );
  const countryMax = useMemo(
    () => Math.max(...countryBarData.map((d) => d.value), 1),
    [countryBarData]
  );
  const pageMax = useMemo(
    () => Math.max(...pageBarData.map((d) => d.value), 1),
    [pageBarData]
  );

  const summaryContent = (
    <div className="space-y-4 px-4 py-2.5">
   
      {hasLiveData && (
        <div className="flex items-center justify-between pb-1 text-neutral-600">
          <p className="text-[15px] font-medium">
            •{" "}
            <span className="font-bricolageGrotesque">
              {dashboardData.total}
            </span>{" "}
            live visitors
          </p>
        </div>
      )}

      {hasLiveData && (
        <>
          <SummaryRow
            label="Referrers"
            count={dashboardData.referrers[0].count}
            onExpand={() => handleExpand("referrers")}
            renderValue={() => (
              <span className="text-base flex items-center gap-x-3 font-medium text-neutral-600">
                <ArrowRight size={15} />
                {dashboardData.referrers[0].source}
              </span>
            )}
          />

          <SummaryRow
            label="Countries"
            count={dashboardData.countries[0].count}
            onExpand={() => handleExpand("countries")}
            renderValue={() => (
              <div className="flex items-center gap-2 text-base font-medium text-neutral-600">
                <span
                  className="h-5 w-5 rounded-full border border-neutral-300 shrink-0"
                  style={{
                    background: getFlagStyle(dashboardData.countries[0].code),
                  }}
                />
                <span>{dashboardData.countries[0].country}</span>
              </div>
            )}
          />

          <SummaryRow
            label="Pages"
            count={dashboardData.pages[0]?.count ?? 0}
            onExpand={() => handleExpand("pages")}
            renderValue={() => (
              <span className="text-base font-medium text-neutral-600">
                {dashboardData.pages[0]?.page ?? "No data"}
              </span>
            )}
          />
        </>
      )}
    </div>
  );

  const detailContent = (
    <>
      {activeSection === "referrers" && (
        <DetailView
          title="Referrers"
          onBack={handleBack}
          barData={referrerBarData}
          maxValue={referrerMax}
        />
      )}
      {activeSection === "countries" && (
        <DetailView
          title="Countries"
          onBack={handleBack}
          barData={countryBarData}
          maxValue={countryMax}
        />
      )}
      {activeSection === "pages" && (
        <DetailView
          title="Pages"
          onBack={handleBack}
          barData={pageBarData}
          maxValue={pageMax}
        />
      )}
    </>
  );

  return (
    <div className="relative min-h-screen">
      <Globe dataPoints={dashboardData.globe} />

      <div className="fixed inset-x-0 bottom-4 z-20 px-3">
        {hasLiveData ? (
          <div className="mx-auto w-full max-w-[24rem] pb-3 overflow-hidden rounded-3xl border border-neutral-200/70 bg-neutral-100/90 shadow-[0_10px_40px_rgba(0,0,0,0.12)] backdrop-blur-sm">
            <AnimatedCardBody
              activeSection={activeSection}
              summaryContent={summaryContent}
              detailContent={detailContent}
            />
          </div>
        ) : (
          <div className="mx-auto w-fit px-3 py-1 overflow-hidden rounded-3xl border border-neutral-200/70 bg-neutral-100/90 shadow-[0_10px_40px_rgba(0,0,0,0.12)] backdrop-blur-sm">
            <h1 className="font-bricolageGrotesque flex items-center gap-x-2 text-[20px] font-medium text-neutral-500">
              {" "}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 14 14"
                id="Web--Streamline-Core"
                height="18"
                width="18"
              >
                <desc>Web Streamline Icon: https://streamlinehq.com</desc>
                <g id="web--server-world-internet-earth-www-globe-worldwide-web-network">
                  <path
                    id="Vector"
                    stroke="#000000"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 13.5c3.5899 0 6.5 -2.9101 6.5 -6.5C13.5 3.41015 10.5899 0.5 7 0.5 3.41015 0.5 0.5 3.41015 0.5 7c0 3.5899 2.91015 6.5 6.5 6.5Z"
                    strokeWidth="1"
                  ></path>
                  <path
                    id="Vector_2"
                    stroke="#000000"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M0.5 7h13"
                    strokeWidth="1"
                  ></path>
                  <path
                    id="Vector_3"
                    stroke="#000000"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.5 7c-0.1228 2.37699 -0.99832 4.6533 -2.5 6.5C5.49832 11.6533 4.6228 9.37699 4.5 7c0.1228 -2.37699 0.99832 -4.65335 2.5 -6.5C8.50168 2.34665 9.3772 4.62301 9.5 7v0Z"
                    strokeWidth="1"
                  ></path>
                </g>
              </svg>
              0{" "}
            </h1>
          </div>
        )}
      </div>
    </div>
  );
}