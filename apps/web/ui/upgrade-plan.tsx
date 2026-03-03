"use client";
import useWorkspace from "@/lib/swr/use-workspace";
import { Button } from "@repo/ui";
import { APP_DOMAIN, cn, Plans } from "@repo/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getStripe } from "@/lib/stripe/client";

export function UpgradePlanButton({
  plan,
  period,
  text,
  variant = "primary",
  className,
  disabled = false,
}: {
  plan: string;
  period: "monthly" | "yearly";
  text?: string;
  variant?: "primary" | "secondary";
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const [clicked, setClicked] = useState(false);

  const { slug } = useWorkspace();
  const currentPlan = "free";

  const selectedPlan = Plans.find(
    (p) => p.name.toLowerCase() === plan.toLowerCase()
  );

  const isCurrentPlan =
    selectedPlan?.name.toLowerCase() === currentPlan.toLowerCase();

  return (
    <Button
      onClick={() => {
        setClicked(true);
        fetch(`/api/workspaces/${slug}/billing/upgrade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan,
            period,
            baseUrl: `${APP_DOMAIN}${pathname}${queryString.length > 0 ? `?${queryString}` : ""}`,
            onboarding: searchParams.get("workspace") ? "true" : "false",
          }),
        })
          .then(async (res) => {
            if (currentPlan === "free") {
              const data = await res.json();
              const { id: sessionId } = data;
              const stripe = await getStripe();
              stripe?.redirectToCheckout({ sessionId });
            } else {
              const { url } = await res.json();
              router.push(url);
            }
          })
          .catch((err) => {
            console.error("Upgrade failed", err);
            setClicked(false);
          })
          .finally(() => {
            setClicked(false);
          });
      }}
      variant={variant}
      className={cn(" text-[13.5px] font-default text-white", className)}
      disabled={disabled}
      text={text}
    ></Button>
  );
}
