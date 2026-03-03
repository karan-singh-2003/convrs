import { WorkspaceRole } from "@repo/db/client";
import { useFieldArray, useForm } from "react-hook-form";
import { Input, useMediaQuery, Button } from "@repo/ui";
import { Plus, Trash } from "lucide-react";
import { pluralize } from "@repo/utils";
import useWorkspace from "@/lib/swr/use-workspace";
import { Invites } from "@/lib/zod/schemas/invites";
import { toast } from "sonner";

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
  const { id, slug, loading } = useWorkspace();

  const {
    control,
    register,
    handleSubmit,
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
        if (!res.ok) {
          const { error } = await res.json();
          toast.error(error || "Failed to send invites");
          return;
        }
        onSuccess();
      })}
      className={`flex flex-col  mx-auto justify-center items-center gap-y-5 ${className}`}
    >
      <div className="flex flex-col gap-2 w-full">
        {fields.map((field, index) => (
          <div key={field.id} className="relative w-full">
            <label>
              {index === 0 && (
                <span className="mb-2 block text-sm font-medium text-neutral-700">
                  {pluralize("Email", fields.length)}
                </span>
              )}
              <div className="relative flex  shadow-sm">
                <input
                  type="email"
                  placeholder="panic@thedis.co"
                  autoFocus={index === 0 && !isMobile}
                  autoComplete="off"
                  className="z-10 block w-full  border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-neutral-500 sm:text-sm"
                  {...register(`teammates.${index}.email`, {
                    required: index === 0,
                  })}
                />
                <select
                  {...register(`teammates.${index}.role`, {
                    required: index === 0,
                  })}
                  defaultValue="member"
                  className=" border border-l-0 border-neutral-300 bg-white pl-4 pr-8 text-neutral-600 focus:border-neutral-300 focus:outline-none focus:ring-0 sm:text-sm"
                >
                  {["owner", "member"].map((value) => {
                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    );
                  })}
                </select>
              </div>
            </label>
            {index > 0 && (
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full">
                <Button
                  variant="outline"
                  icon={<Trash className="size-4" />}
                  className="h-8 px-1"
                  onClick={() => remove(index)}
                />
              </div>
            )}
          </div>
        ))}
        <Button
          className="h-9 w-full"
          variant="secondary"
          text="Add email"
          onClick={() => append({ email: "", role: "member" })}
        />
      </div>
      <Button
        className="text-white"
        text={`Send ${pluralize("invite", fields.length)}`}
        disabled={loading || isSubmitting}
        loading={isSubmitting}
      />
    </form>
  );
};
