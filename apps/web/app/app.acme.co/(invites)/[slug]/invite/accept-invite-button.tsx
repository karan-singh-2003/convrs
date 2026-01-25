"use client";
import * as React from "react";
import { Button } from "@repo/ui";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export function AcceptInviteButton() {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const { slug } = useParams();

  const acceptInvite = async () => {
    // update the loading state
    setIsAccepting(true);

    try {
      const response = await fetch(`/api/workspaces/${slug}/invites/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to accept invite");
      }

      router.replace(`/${slug}`);
      toast.success("You are now a part of this workspace!");
    } catch (error) {
      console.error("Error accepting invite:", error);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <Button
      text="Accept Invite"
      loading={isAccepting}
      onClick={acceptInvite}
      className="text-white"
    />
  );
}
