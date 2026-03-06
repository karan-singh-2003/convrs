"use client";
import { Input, useMediaQuery, Button, FileUpload } from "@repo/ui";
import { useForm, Controller } from "react-hook-form";
import { Label } from "@repo/ui";
import { set, z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleFill } from "@repo/ui";
import { cn } from "@repo/utils";
import { createWorkspaceSchema } from "@/lib/zod/schemas/workspaces";
import { toast } from "sonner";

type formData = z.infer<typeof createWorkspaceSchema>;

export function CreateWorkspaceForm({
  onSuccess,
}: {
  onSuccess: (data: formData) => void;
}) {
  const { isMobile } = useMediaQuery();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    clearErrors,
    setError,
    setValue,
    control,
  } = useForm<formData>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const slug = watch("slug");

  return (
    <form
      onSubmit={handleSubmit(async (data: formData) => {
        try {
          const res = await fetch("/api/workspaces", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          });
          if (res.ok) {
            const { id: workspaceId } = await res.json();
            onSuccess?.(data);
          } else {
            const { error } = await res.json();
            toast.error(error.message);
            setError("name", { message: error.message });
          }
        } catch (e) {
          toast.error("Failed to create workspace. Please try again.");
          setError("name", {
            message: "Failed to create workspace. Please try again.",
          });
        }
      })}
      className="w-full  space-y-4"
    >
      <div className="flex flex-col gap-y-2.5">
        <Label className="font-display text-neutral-600">Workspace Name</Label>
        <Input
          {...register("name", {
            onChange: (e) => setValue("slug", e.target.value),
          })}
          id="name"
          autoComplete="off"
          autoFocus={!isMobile}
          placeholder="Acme Inc."
          error={errors.name?.message}
        />
      </div>
      <div>
        <Label className="font-display text-neutral-600">Workspace Slug</Label>

        <div className="mt-2 flex min-w-0">
          <span className="inline-flex shrink-0 items-center rounded-l-sm border border-r-0 border-neutral-300 bg-neutral-50 px-2 sm:px-3 font-medium font-display text-neutral-500 text-[13px] sm:text-sm">
            app.{process.env.NEXT_PUBLIC_APP_DOMAIN}
          </span>
          <Input
            id="slug"
            type="text"
            autoComplete="off"
            placeholder="acme"
            error={errors.slug?.message}
            className="flex-1 font-display min-w-0 [&_input]:rounded-l-none"
            {...register("slug")}
            onBlur={() => {
              fetch(`/api/workspaces/check-workspace-slug?slug=${slug}`).then(
                async (res) => {
                  if (res.status !== 200) return;
                  const exists = await res.json();
                  if (exists === 1) {
                    setError("slug", {
                      message: `"${slug}" is already taken.`,
                    });
                  } else {
                    clearErrors("slug");
                  }
                }
              );
            }}
          />
        </div>
      </div>
      <div>
        <Label className="font-display text-neutral-600">Workspace logo</Label>
        <div className="mt-1.5 flex items-center gap-5">
          <Controller
            control={control}
            name="logo"
            render={({ field }) => (
              <FileUpload
                accept="images"
                className={cn(
                  "size-20 rounded-full border border-neutral-300",
                  errors.logo && "border-0 ring-2 ring-red-500"
                )}
                iconClassName="size-5"
                previewClassName="size-10 rounded-full"
                variant="plain"
                imageSrc={field.value as string | null | undefined}
                readFile
                onChange={({ src }) => field.onChange(src)}
                content={null}
                maxFileSizeMB={2}
                targetResolution={{ width: 160, height: 160 }}
              />
            )}
          />
          <div>
            <p className="mt-1.5 text-[12.5px] font-display font-medium text-neutral-500">
              Recommended size: 160x160px
            </p>
          </div>
        </div>
      </div>

      <Button
        loading={isSubmitting || isSubmitSuccessful}
        text="Create workspace"
        className="text-white font-display"
      />
    </form>
  );
}
