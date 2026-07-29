import React from "react";
import { DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import { WeeklyReportPdf } from "./weekly-report-pdf";
import type { WeeklySummaryStats } from "../../../../apps/web/lib/analytics/weekly-summary";
// same import-path caveat as weekly-report-pdf.tsx — adjust to your actual
// monorepo path, or centralize the type in a shared package

export async function generateWeeklyReportPdf({
    workspaceName,
    stats,
}: {
    workspaceName: string;
    stats: WeeklySummaryStats;
}): Promise<Buffer> {
    return renderToBuffer(
        React.createElement(
            WeeklyReportPdf,
            { workspaceName, stats }
        ) as React.ReactElement<DocumentProps>
    );
}