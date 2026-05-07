"use client";

import { useSession } from "next-auth/react";
import Form from "@/ui/shared/form";
import UploadAvatar from "@/ui/account/upload-avatar";
import DeleteAccount from "@/ui/account/delete-account";
import UserId from "@/ui/account/user-id";
import { toast } from "sonner";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";

export function SettingsPageClient() {
  const { data: session, status, update } = useSession();

  return (
    <SettingsChildrenLayout
      title="General"
      description="Put a face to your name, edit your login details, and set preferences"
      className="lg:px-8 px-3"
    >
      <div className="space-y-6 ">
        <Form
          title="Your Name"
          description={`This is your name on ${process.env.NEXT_PUBLIC_APP_NAME}`}
          inputAtts={{
            name: "name",
            defaultValue: status === "loading" ? "" : session?.user?.name || "",
            placeholder: "Steve Jobs",
            maxLength: 32,
          }}
          buttonText="Update Name"
          handleSubmit={async (data) => {
            fetch(`/api/user`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ name: data.name }),
            }).then(async (res) => {
              if (res.status === 200) {
                update();
                toast.success("Name updated successfully.");
              } else {
                const errorData = await res.json();
                toast.error(errorData?.error || "Failed to update name.");
              }
            });
          }}
        />
        <Form
          title="Your Email"
          description={`This is your email on ${process.env.NEXT_PUBLIC_APP_NAME}`}
          inputAtts={{
            name: "email",
            defaultValue:
              status === "loading" ? "" : session?.user?.email || "",
            placeholder: "steve.jobs@example.com",
            maxLength: 32,
          }}
          buttonText="Update Email"
          handleSubmit={async (data) => {
            fetch(`/api/user`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email: data.email }),
            }).then(async (res) => {
              if (res.status === 200) {
                toast.success(
                  `A confirmation email has been sent to ${data.email}. Please check your inbox to confirm the change.`
                );
              } else {
                const errorData = await res.json();
                toast.error(errorData?.error || "Failed to update email.");
              }
            });
          }}
        />
        <UploadAvatar />
        <UserId />
        <DeleteAccount />
      </div>
    </SettingsChildrenLayout>
  );
}
