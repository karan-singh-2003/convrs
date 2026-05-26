"use client";

import React from "react";
import { Button } from "@repo/ui";
import { signOut, useSession } from "next-auth/react";
import { Check } from "lucide-react";
import { cn } from "@repo/utils";

const steps = [
  {
    id: 1,
    title: "Add website",
  },
  {
    id: 2,
    title: "Install script",
  },
];

type SignedInHintProps = {
  currentStep?: number;
};

const SignedInHint = ({ currentStep = 1 }: SignedInHintProps) => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <div className="fixed left-0 top-0 z-50 w-full border-b border-neutral-200 bg-white">
      <div className="mx-auto grid h-14 w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 sm:px-6">
        {/* Left Logo */}
        <div className="justify-self-start">
          <h1 className="font-medium text-neutral-600 text-sm font-poppins">
            Convrs
          </h1>
        </div>

        {/* Center Steps */}
        <div className="hidden justify-self-center md:flex">
          <div className="flex items-center">
            {steps.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-3">
                    {/* Step Circle */}
                    <div
                      className={cn(
                        "flex h-6 w-6 font-display  items-center justify-center rounded-full text-[12px] font-medium transition-colors",
                        isActive && "bg-neutral-800 text-white",
                        isCompleted && "bg-neutral-800 text-white",
                        !isActive &&
                          !isCompleted &&
                          "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        step.id
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={cn(
                        "text-[14px] font-medium font-display transition-colors",
                        isActive ? "text-neutral-900" : "text-neutral-500"
                      )}
                    >
                      {step.title}
                    </span>
                  </div>

                  {/* Divider */}
                  {index !== steps.length - 1 && (
                    <div className="mx-5 h-px w-24 border-t border-neutral-300" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex shrink-0 items-center justify-self-end gap-3">
          {session && (
            <p className="hidden max-w-[130px] font-display truncate text-[13px] font-medium text-neutral-500 lg:block">
              {session.user?.email}
            </p>
          )}

          <Button
            variant="primary"
            text="Sign Out"
            onClick={() => {
              setIsLoading(true);

              signOut({
                callbackUrl: "/login",
              });
            }}
            loading={isLoading}
            className="h-9 w-fit font-display bg-white px-3 text-[13px] font-medium text-neutral-700 shadow-none hover:bg-neutral-50"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SignedInHint;
