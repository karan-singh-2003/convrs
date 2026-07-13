"use client";

import Form from "@/ui/shared/form";
import { Switch } from "@repo/ui";

export function AdditionalDomains() {
    return (



        <Form
            title="Add Additional Domains"
            description={`Add domains to allow sending analytics data to this website.`}
            inputAtts={{
                name: "domain",
                placeholder: "www.example.com",
            }}
            buttonText="Add Domain"
            disabledTooltip={undefined}
            handleSubmit={async (data) => {
                console.log("data", data)
            }}
        >
            <div className="mt-3 rounded-xl bg-neutral-100 p-3">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="font-display text-sm font-medium text-neutral-600">
                            Allow all domains
                        </h3>
                        <p className="mt-0.5 font-medium font-display text-[13.5px] text-neutral-500">
                            Useful for embedded widgets and custom domains.
                        </p>
                    </div>

                    <Switch
                        trackDimensions="radix-state-checked:bg-black focus-visible:ring-black/20 w-7 h-4"
                        thumbDimensions="size-3"
                        thumbTranslate="translate-x-3"
                    />
                </div>
            </div>
        </Form>

    );
}