import React from "react";
import { DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import { WeeklyReportPdf } from "./weekly-report-pdf";
import type { WeeklySummaryStats } from "./types";

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