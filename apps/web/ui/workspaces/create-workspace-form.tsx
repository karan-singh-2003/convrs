"use client";

import { Input, useMediaQuery, Button, Combobox } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Label } from "@repo/ui";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspaceSchema } from "@/lib/zod/schemas/workspaces";
import { toast } from "sonner";
import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { detectBrowserTimezone, getTimezoneOptions } from "@/lib/timezone";

type FormData = z.infer<typeof createWorkspaceSchema>;

type CreatedWorkspace = {
  slug: string;
  domain: string | null;
  projectToken: string | null;
};

export function CreateWorkspaceForm({
  onSuccess,
  withTimezone = false,
}: {
  onSuccess: (data: CreatedWorkspace) => void;
  withTimezone?: boolean;
}) {
  const router = useRouter();
  const { isMobile } = useMediaQuery();

  // Browser-detected timezone; used as the default selection when the
  // timezone field is shown. The API also falls back to detection server-side.
  const defaultTimezone = useMemo(() => detectBrowserTimezone(), []);
  const timezoneOptions = useMemo(() => getTimezoneOptions(new Date()), []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    clearErrors,
    setError,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      slug: "",
      domain: "",
      // Only carry a timezone when the field is actually shown, so other
      // callers of this form (e.g. the create-workspace modal) are unchanged.
      ...(withTimezone ? { timezone: defaultTimezone } : {}),
    },
  });

  const name = watch("name");
  const slug = watch("slug");
  const timezone = watch("timezone");

  const selectedTimezone =
    timezoneOptions.find((option) => option.value === timezone) ?? null;

  // 🔥 slug generator
  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  async function createWorkspace(data: FormData): Promise<{
    id: string;
    slug: string;
    domain: string | null;
    projectToken: string | null;
    subscriptionStatus?: string | null;
    freeTrialEndDate?: string | null;
  }> {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || "Failed to create workspace");
    }

    return res.json();
  }

  async function onSubmit(data: FormData) {
    let workspace: Awaited<ReturnType<typeof createWorkspace>> | null = null;

    try {
      const createWorkspacePromise = createWorkspace(data);
      toast.promise(createWorkspacePromise, {
        loading: "Creating your workspace...",
        success: `Workspace "${data.name}" created!`,
        error: (err: Error) => err.message,
      });
      workspace = await createWorkspacePromise;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create workspace";
      setError("name", { message });
      return;
    }

    if (!workspace) return;

    // Trial activation is fully server-side now (POST /api/workspaces —
    // lib/billing/auto-trial.ts): an eligible user's first owned workspace
    // is auto-covered by the 14-day cardless trial as part of that same
    // request. This is just a courtesy toast reflecting what already
    // happened — there is no separate client-initiated trial call anymore.
    if (workspace.subscriptionStatus === "trialing" && workspace.freeTrialEndDate) {
      toast.success(
        `Your 14-day free trial has started! Enjoy full access until ${new Date(
          workspace.freeTrialEndDate
        ).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        })}.`
      );
    }

    onSuccess?.({
      slug: workspace.slug,
      domain: workspace.domain ?? null,
      projectToken: workspace.projectToken ?? null,
    });
    if (!onSuccess) {
      router.push(`/${workspace.slug}`);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        handleSubmit(onSubmit)(e);
      }}
      className="w-full space-y-4"
    >
      {/* Project Name */}
      <div className="flex flex-col gap-y-2.5">
        <Label className="font-display text-neutral-600">Project Name</Label>
        <Input
          {...register("name")}
          id="name"
          autoComplete="off"
          autoFocus={!isMobile}
          placeholder="Acme Inc."
          error={errors.name?.message}
          onChange={async (e) => {
            const value = e.target.value;
            const generated = generateSlug(value);

            setValue("name", value);
            setValue("slug", generated);

            if (!generated) return;

            //  check availability
            const res = await fetch(
              `/api/workspaces/check-workspace-slug?slug=${generated}`
            );

            if (res.status !== 200) return;

            const exists = await res.json();

            if (exists === 1) {
              setError("name", {
                message: `"${value}" is already taken.`,
              });
            } else {
              clearErrors("name");
            }
          }}
        />
      </div>

      {/* Domain */}
      <div>
        <Label className="font-display text-neutral-600">Domain</Label>

        <div className="mt-2 flex min-w-0">
          <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 px-2 sm:px-3 font-medium font-display text-neutral-500 text-[13px] sm:text-[14.5px]">
            https://
          </span>

          <Input
            type="text"
            placeholder="acme.com"
            autoComplete="off"
            className="flex-1 font-display min-w-0 [&_input]:rounded-l-none"
            {...register("domain")}
          />
        </div>
        {errors.domain && (
          <p className="text-[13px] my-1 font-default text-red-500">
            {errors.domain.message}
          </p>
        )}
      </div>

      {/* Time zone */}
      {withTimezone && (
        <div>
          <Label className="font-display text-neutral-600">Time zone</Label>

          <div className="mt-2">
            <Combobox
              selected={selectedTimezone}
              setSelected={(option) => {
                if (option) setValue("timezone", option.value);
              }}
              options={timezoneOptions}
              searchPlaceholder="Search timezone..."
              placeholder="Select timezone"
              trigger={
                <button
                  type="button"
                  className="flex w-full items-center justify-between font-display rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-[14.5px] text-neutral-500 transition hover:bg-neutral-200"
                >
                  <span className="truncate">
                    {selectedTimezone?.label ?? "Select timezone"}
                  </span>

                  <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" />
                </button>
              }
            />
          </div>
          {errors.timezone && (
            <p className="text-[13px] my-1 font-default text-red-500">
              {errors.timezone.message}
            </p>
          )}
        </div>
      )}

      <Button
        type="submit"
        loading={isSubmitting || isSubmitSuccessful}
        text="Create workspace"
        className="text-white font-display"
      />
    </form>
  );
}
