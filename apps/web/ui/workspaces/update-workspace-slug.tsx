'use client'
import useWorkspace from "@/lib/swr/use-workspace";
import Form from "../shared/form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { clientAccessCheck } from "@/lib/client-access-check";
export default function UpdateWorkspaceSlug() {
  const { name, slug, id, role } = useWorkspace();
  const router = useRouter();
  const {update} = useSession();
  const permissionError = clientAccessCheck({
    action: "workspace:write",
    role,
  }).error;
  return (
    <Form
      title="Workspace Slug"
      description={`This is the slug of your workspace on ${process.env.NEXT_PUBLIC_APP_NAME}`}
      inputAtts={{
        name: "slug",
        defaultValue: slug,
        placeholder: "my-workspace",
        maxLength: 32,
      }}
      buttonText="Update Slug"
      disabledTooltip={permissionError || undefined}
      handleSubmit={async (data) => {
        await fetch(`/api/workspaces/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ slug: data.slug }),
        }).then(async (res) => {
          if (res.status === 200) {
            const {slug:newSlug} = await res.json();
            if(newSlug !== slug){
              router.push(`/${newSlug}/settings`);
              update();
            }
            toast.success("Workspace slug updated successfully.");
          } else {
            const errorData = await res.json();
            toast.error(errorData?.error || "Failed to update workspace slug.");
          }
        });
      }}
    />
  );
}
