import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { WeeklySummaryStats } from "../../../../apps/web/lib/analytics/weekly-summary";
// ^ adjust this import path to wherever WeeklySummaryStats actually resolves
// from in your monorepo — if @repo/email can't reach that app-level path,
// move the WeeklySummaryStats type into a shared package (e.g. @repo/types)
// and import from there instead. Flagging this because I don't have your
// tsconfig paths/workspace layout to confirm the correct relative import.

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  header: {
    marginBottom: 20,
    borderBottom: "1 solid #e5e5e5",
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#666666",
  },
  overviewRow: {
    flexDirection: "row",
    marginBottom: 24,
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    border: "1 solid #e5e5e5",
    borderRadius: 4,
    padding: 10,
  },
  overviewLabel: {
    fontSize: 8,
    color: "#666666",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: 700,
  },
  overviewChange: {
    fontSize: 8,
    marginTop: 2,
  },
  changeUp: { color: "#16a34a" },
  changeDown: { color: "#dc2626" },
  changeFlat: { color: "#999999" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionRow: {
    flexDirection: "row",
    gap: 16,
  },
  table: {
    flex: 1,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1 solid #d4d4d4",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 700,
    color: "#666666",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottom: "0.5 solid #f0f0f0",
  },
  tableCellLabel: {
    flex: 1,
    fontSize: 9,
  },
  tableCellValue: {
    width: 50,
    fontSize: 9,
    textAlign: "right",
  },
  emptyText: {
    fontSize: 9,
    color: "#999999",
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
    borderTop: "1 solid #e5e5e5",
    paddingTop: 8,
  },
});

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatCurrency(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function fmtChange(pct: number | null) {
  if (pct === null) return { text: "—", style: styles.changeFlat };
  const style = pct > 0 ? styles.changeUp : pct < 0 ? styles.changeDown : styles.changeFlat;
  return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`, style };
}

function formatDateRange(startIso: string, endIso: string) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(new Date(startIso))} – ${fmt(new Date(endIso))}`;
}

function Table({
  title,
  rows,
  labelKey,
  valueKey = "clicks",
  valueLabel = "Visitors",
}: {
  title: string;
  rows: Record<string, any>[];
  labelKey: string;
  valueKey?: string;
  valueLabel?: string;
}) {
  return (
    <View style={styles.table}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No data for this period.</Text>
      ) : (
        <>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableCellLabel, styles.tableHeaderCell]}>{title}</Text>
            <Text style={[styles.tableCellValue, styles.tableHeaderCell]}>{valueLabel}</Text>
          </View>
          {rows.map((row, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.tableCellLabel}>{String(row[labelKey] ?? "—")}</Text>
              <Text style={styles.tableCellValue}>
                {Number(row[valueKey] ?? 0).toLocaleString()}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

export function WeeklyReportPdf({
  workspaceName,
  stats,
}: {
  workspaceName: string;
  stats: WeeklySummaryStats;
}) {
  const clicksChange = fmtChange(stats.clicksChangePct);
  const revenueChange = fmtChange(stats.revenueChangePct);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{workspaceName} — Weekly Report</Text>
          <Text style={styles.subtitle}>{formatDateRange(stats.weekStart, stats.weekEnd)}</Text>
        </View>

        {/* Overview */}
        <View style={styles.overviewRow}>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>Visitors</Text>
            <Text style={styles.overviewValue}>{stats.clicks.toLocaleString()}</Text>
            <Text style={[styles.overviewChange, clicksChange.style]}>{clicksChange.text}</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>Revenue</Text>
            <Text style={styles.overviewValue}>
              {formatCurrency(stats.revenue, stats.currency)}
            </Text>
            <Text style={[styles.overviewChange, revenueChange.style]}>{revenueChange.text}</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>Conversion Rate</Text>
            <Text style={styles.overviewValue}>{stats.conversionRate.toFixed(1)}%</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>Bounce Rate</Text>
            <Text style={styles.overviewValue}>{stats.bounceRate.toFixed(1)}%</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>Avg. Session</Text>
            <Text style={styles.overviewValue}>{formatDuration(stats.avgSessionDuration)}</Text>
          </View>
        </View>

        {/* Top pages / links */}
        <View style={styles.sectionRow}>
          <Table title="Top Pages" rows={stats.topPages} labelKey="page" />
          <Table title="Top Links" rows={stats.topLinks} labelKey="url" />
        </View>

        <View style={styles.sectionRow}>
          <Table title="Entry Pages" rows={stats.entryPages} labelKey="entrypage" />
          <Table title="Exit Links" rows={stats.exitLinks} labelKey="exitlink" />
        </View>

        {/* Devices / Browsers / OS */}
        <View style={styles.sectionRow}>
          <Table title="Devices" rows={stats.devices} labelKey="device" />
          <Table title="Browsers" rows={stats.browsers} labelKey="browser" />
          <Table title="OS" rows={stats.os} labelKey="os" />
        </View>

        {/* Locations */}
        <View style={styles.sectionRow}>
          <Table title="Top Countries" rows={stats.topCountries} labelKey="countryLabel" />
          <Table title="Top Regions" rows={stats.topRegions} labelKey="region" />
        </View>
        <View style={styles.sectionRow}>
          <Table title="Top Cities" rows={stats.topCities} labelKey="city" />
        </View>

        {/* Sources */}
        <View style={styles.sectionRow}>
          <Table title="Referrers" rows={stats.referers} labelKey="referer" />
          <Table title="UTM Sources" rows={stats.utmSources} labelKey="utm_source" />
        </View>

        <View style={styles.footer} fixed>
          <Text>Generated by Convrs · {new Date().toLocaleDateString("en-US")}</Text>
        </View>
      </Page>
    </Document>
  );
}