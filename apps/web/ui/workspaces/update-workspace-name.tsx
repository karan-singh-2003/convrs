import useWorkspace from "@/lib/swr/use-workspace";
import Form from "../shared/form";
import { toast } from "sonner";
import { clientAccessCheck } from "@/lib/client-access-check";

export default function UpdateWorkspaceName() {
  const { name, slug, id, role } = useWorkspace();
  const permissionError = clientAccessCheck({
    action: "workspace:write",
    role,
  }).error;
  return (
    <Form
      title="Workspace Name"
      description={`This is the name of your workspace on ${process.env.NEXT_PUBLIC_APP_NAME}`}
      inputAtts={{
        name: "name",
        defaultValue: name,
        placeholder: "My Workspace",
        maxLength: 32,
      }}
      buttonText="Update Name"
      disabledTooltip={permissionError || undefined}
      handleSubmit={async (data) => {
        fetch(`/api/workspaces/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: data.name }),
        }).then(async (res) => {
          if (res.status === 200) {
            toast.success("Workspace name updated successfully.");
          } else {
            const errorData = await res.json();
            toast.error(errorData?.error || "Failed to update workspace name.");
          }
        });
      }}
    />
  );
}
