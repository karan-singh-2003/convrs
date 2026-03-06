import { WorkspaceRole } from "@repo/db/client";
import { useFieldArray, useForm } from "react-hook-form";
import { useMediaQuery, Button } from "@repo/ui";
import { cn } from "@repo/utils";
import { ChevronDown, X } from "lucide-react";
import { pluralize } from "@repo/utils";
import useWorkspace from "@/lib/swr/use-workspace";
import { mutatePrefix } from "@/lib/swr/mutate";
import { Invites } from "@/lib/zod/schemas/invites";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { clientAccessCheck } from "@/lib/client-access-check";

const ROLES = [
  {
    value: "owner" as WorkspaceRole,
    label: "Owner",
    description:
      "Can manage members, assign roles, and update workspace settings.",
  },
  {
    value: "member" as WorkspaceRole,
    label: "Member",
    description:
      "Can contribute to workspace content but cannot manage members.",
  },
] as const;

function RoleDropdown({
  role,
  onChange,
}: {
  role: WorkspaceRole;
  onChange: (role: WorkspaceRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={ref}
      className="relative shrink-0 border-l z-60 border-neutral-200"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="font-display flex items-center gap-1 h-10 px-3 text-[13px] text-neutral-500 hover:bg-neutral-50 transition whitespace-nowrap"
      >
        {role}
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <div className="absolute right-0 md:left-0 top-full mt-1.5 w-60 sm:w-[18rem] border border-neutral-200 bg-white shadow-lg rounded-none z-50">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                onChange(r.value);
                setOpen(false);
              }}
              className={cn(
                "font-display w-full text-left px-4 py-2.5 hover:bg-neutral-50 transition first:rounded-t-md last:rounded-b-md",
                role === r.value && "bg-neutral-50"
              )}
            >
              <div className="text-[13px] font-medium text-neutral-600">
                {r.label}
              </div>
              <div className="text-[13px] mt-1 font-default font-medium text-neutral-500">
                {r.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type FormData = {
  teammates: { email: string; role: WorkspaceRole }[];
};

export const InviteTeammatesForm = ({
  onSuccess,
  invites = [],
  className,
}: {
  onSuccess: () => void;
  invites?: Invites[];
  className?: string;
}) => {
  const { isMobile } = useMediaQuery();
  const { id, slug, loading, userLimit } = useWorkspace();
console.log("userLimit", userLimit);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, isSubmitSuccessful },
  } = useForm<FormData>({
    defaultValues: {
      teammates: invites.length ? invites : [{ email: "", role: "member" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "teammates",
    control,
  });

  const teammates = watch("teammates");

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        if (!id || !slug) {
          toast.error("Workspace not found");
          return;
        }

        const teammates = data.teammates.filter(({ email }) => email);

        const res = await fetch(`/api/workspaces/${id}/invites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ teammates }),
        });

        if (res.ok) {
          await mutatePrefix(`/api/workspaces/${id}/invites`);
          toast.success(`${pluralize("Invitation", teammates.length)} sent!`);
          onSuccess();
        } else {
          const { error } = await res.json();
          if (
            typeof error?.message === "string" &&
            error.message.toLowerCase().includes("upgrade")
          ) {
            toast.error(
              "You've reached the invite limit for your plan. Please upgrade to invite more teammates."
            );
          } else {
            toast.error(
              (typeof error === "string" ? error : error?.message) ||
                "Failed to send invites"
            );
          }
          throw error;
        }
      })}
      className={cn("font-display flex flex-col gap-y-4 w-full", className)}
    >
      <div className="space-y-2 w-full">
        {fields.map((field, index) => (
          <div key={field.id} className="relative">
            <div className="flex w-full border border-neutral-200 bg-white rounded-none">
              <input
                type="email"
                placeholder="member@email.com"
                autoFocus={index === 0 && !isMobile}
                autoComplete="off"
                className="font-display flex-1 min-w-0 w-full h-10 px-3 text-sm text-neutral-700 placeholder-neutral-400 bg-transparent border-0 outline-none focus:ring-0"
                {...register(`teammates.${index}.email`, {
                  required: index === 0,
                })}
              />

              <RoleDropdown
                role={teammates?.[index]?.role || "member"}
                onChange={(role) => setValue(`teammates.${index}.role`, role)}
              />
            </div>

            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="absolute -top-2 -right-2 size-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs shadow-sm"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          className="font-display w-full h-9 text-[13px] text-neutral-500 font-medium bg-white hover:bg-neutral-50 transition rounded-none disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => append({ email: "", role: "member" })}
          disabled={fields.length >= (userLimit ?? Infinity)}
        >
          Add more members
        </button>
      </div>

      <Button
        className="font-display w-full h-9 mt-5 rounded-[3px] bg-black/90 text-white text-sm"
        text={`Send ${pluralize("invite", fields.length)}`}
        disabled={loading || isSubmitting || isSubmitSuccessful}
        loading={isSubmitting || isSubmitSuccessful}
      />
    </form>
  );
};
