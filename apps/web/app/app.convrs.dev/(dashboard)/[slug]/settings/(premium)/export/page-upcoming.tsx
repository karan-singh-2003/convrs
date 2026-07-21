"use client";

import { useState } from "react";
import {
    Download,
    Database,
    Globe,
    Calendar,
    FileArchive,
    ShieldCheck,
    Loader2,
    CheckCircle2,
    Info,
} from "lucide-react";

import {
    Button,
    Input,
    Label,
    RadioGroup,
    RadioGroupItem,
} from "@repo/ui";
import { toast } from "sonner";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import useWorkspace from "@/lib/swr/use-workspace";



export default function ExportPage() {
    const { id: workspaceId } = useWorkspace()
    const [loading, setLoading] = useState(false);
    const [range, setRange] = useState("all");
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");

    async function exportWorkspace() {
        try {
            setLoading(true);

            const params = new URLSearchParams();

            if (range === "custom") {
                if (start) params.set("start", start);
                if (end) params.set("end", end);
            }

            const res = await fetch(
                `/api/workspaces/${workspaceId}/export?${params.toString()}`
            );

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error);
            }

            const blob = await res.blob();

            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "convrs-export.zip";
            a.click();

            URL.revokeObjectURL(url);

            toast.success("Export downloaded.");
        } catch (e: any) {
            toast.error(e.message ?? "Failed to export workspace.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <SettingsChildrenLayout
            title="Export Data"
            description="Download a portable copy of your analytics data."
            className="mx-5"
        >
            <div className="mx-1 max-w-4xl rounded-2xl bg-bg-card px-6 py-4 border border-border-subtle">
                <div className="flex flex-col items-start justify-between gap-4">
                    <div className="max-w-2xl font-display">
                        <h2 className="font-display text-[15px] font-medium text-content-default">
                            Export analytics
                        </h2>

                        <p className="mt-1 leading-snug text-[14px]   text-content-subtle">
                            Download a portable ZIP containing your analytics data. Use it to restore
                            another Convrs workspace or migrate to analytics platforms that support
                            Plausible imports.
                        </p>


                    </div>

                    <Button
                        text={loading ? (
                            <>

                                Exporting
                            </>
                        ) : (
                            <>

                                Export ZIP
                            </>
                        )}
                        icon={loading ? (<Loader2 className=" h-3.5 w-3.5 animate-spin" />) : (<Download className=" h-3.5 w-3.5" />)}
                        className="h-8 text-[14px] border border-border-subtle rounded-lg font-display text-content-default w-fit shrink-0"
                        onClick={exportWorkspace}
                        disabled={loading}
                        variant={"outline"}
                    >

                    </Button>
                </div>


            </div >
        </SettingsChildrenLayout >
    );
}

function Item({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="flex gap-3">
            <div className="rounded-md border p-2">{icon}</div>

            <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}

function Compatibility({
    title,
    desc,
}: {
    title: string;
    desc: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500" />

            <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">
                    {desc}
                </p>
            </div>
        </div>
    );
}