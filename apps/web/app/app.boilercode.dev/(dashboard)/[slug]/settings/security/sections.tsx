import { clientAccessCheck } from "@/lib/client-access-check";
import useWorkspace from "@/lib/swr/use-workspace";
import { Button, Switch, TooltipContent, TooltipProvider } from "@repo/ui";
import { Crown } from "lucide-react";
export default function Section({
  title,
  description,
  buttonLabel,
  onButtonClick,
  showRequirement = false,
  configured = false,
  ssoEnforcedAt,
  isLoading,
  handleSSOEnforcementChange,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onButtonClick: () => void;
  showRequirement?: boolean;
  configured?: boolean;
  ssoEnforcedAt?: string | null;
  isLoading?: boolean;
  handleSSOEnforcementChange?: (enabled: boolean) => void;
}) {
  const { plan, role } = useWorkspace();
  const permissionsError = clientAccessCheck({
    action: "workspace:write",
    role,
  }).error;
  return (
    <TooltipProvider>
      <div className=" space-y-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium font-display text-neutral-900">
              {title}
            </h3>
            <PremiumFeature />
          </div>

          <p className="text-[14px] font-display text-neutral-500">
            {description}
          </p>
        </div>

        <Button
          text={buttonLabel}
          variant="secondary"
          className="rounded-none h-fit bg-[#e9e9e9b9] text-black/60 text-[13px] py-1 px-4 w-fit font-display"
          onClick={onButtonClick}
        ></Button>

        {showRequirement && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-[13px] font-medium font-display text-neutral-700">
                  Require SAML login for all workspace members
                </h4>
                <p className="text-[13px] font-display text-neutral-500">
                  When enabled, members must authenticate through your
                  configured identity provider to access this workspace.
                </p>
              </div>
              <Switch
                checked={!!ssoEnforcedAt}
                loading={isLoading}
                fn={handleSSOEnforcementChange}
                disabled={!configured}
              />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function PremiumFeature() {
  return (
    <span className="flex items-center font-default gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium  bg-[#e0f1ff]/50 text-[#1274f5]">
      <Crown className="h-3 w-3" />
      <span className="font-googleSans">Enterprise Plan required</span>
    </span>
  );
}
