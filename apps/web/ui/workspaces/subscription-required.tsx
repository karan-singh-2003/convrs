import Link from "next/link";
import { Button } from "@repo/ui";

export function SubscriptionRequired({
    slug,
}: {
    slug: string;
}) {
    return (
        <div className="relative">
            <div className="justify-center max-w-screen-lg mx-auto px-4 h-[500px]">
                {/* <h1 className="font-default text-sm text-neutral-600">
                    You have used {usage} of {usageLimit} events
                  </h1> */}
            </div>

            <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                <div className="space-y-4">
                    <div className="flex flex-col gap-y-1 text-center mb-4">
                        <h1 className="font-default text-base font-medium text-neutral-600">
                            You dont have an active subscription
                        </h1>
                        <h1 className="font-default text-[14.5px] font-medium text-neutral-500">
                            Pick a plan to view analytics for your websites
                        </h1>
                    </div>
                    <Link href={`/${slug}/settings/billing`} >
                        <Button
                            text="Upgrade"
                            className="font-display font-medium w-fit px-10 mx-auto rounded-full"
                        />
                    </Link>
                </div>
            </div>
        </div>
    );
}