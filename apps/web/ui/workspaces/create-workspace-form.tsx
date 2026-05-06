"use client";

import { Input, useMediaQuery, Button } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Label } from "@repo/ui";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspaceSchema } from "@/lib/zod/schemas/workspaces";
import { toast } from "sonner";

type FormData = z.infer<typeof createWorkspaceSchema>;

export function CreateWorkspaceForm({
  onSuccess,
}: {
  onSuccess: (data: FormData) => void;
}) {
  const router = useRouter();
  const { isMobile } = useMediaQuery();

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
    },
  });

  const name = watch("name");
  const slug = watch("slug");

  // 🔥 slug generator
  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  async function createWorkspace(
    data: FormData
  ): Promise<{ id: string; slug: string }> {
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

  async function startFreeTrial(
    workspaceIdOrSlug: string
  ): Promise<{ trialEndsAt?: string }> {
    const res = await fetch(
      `/api/workspaces/${workspaceIdOrSlug}/billing/start-free-trial`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error || "Failed to start free trial");
    }

    return res.json();
  }

  async function onSubmit(data: FormData) {
    let workspace: { id: string; slug: string } | null = null;

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

    try {
      const startFreeTrialPromise = startFreeTrial(workspace.id);
  
      toast.promise(startFreeTrialPromise, {
        loading: "Starting your free trial...",
        success: (result) => {
          if (!result?.trialEndsAt) {
            return "Free trial started successfully!";
          }

          return `Your 14-day free trial has started! Enjoy full access until ${new Date(
            result.trialEndsAt
          ).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}.`;
        },
        error: (err: Error) => err.message,
      });
      await startFreeTrialPromise;
    } catch {
      toast.warning(
        "Workspace created, but trial setup failed. Visit billing to activate."
      );
    }

    onSuccess?.(data);
    if (!onSuccess) {
      router.push(`/${workspace.slug}`);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-4">
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

            // 🔥 check availability
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
          <span className="inline-flex shrink-0 items-center rounded-l-sm border border-r-0 border-neutral-300 bg-neutral-50 px-2 sm:px-3 font-medium font-display text-neutral-500 text-[13px] sm:text-sm">
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

      <Button
        loading={isSubmitting || isSubmitSuccessful}
        text="Create workspace"
        className="text-white font-display"
      />
    </form>
  );
}
