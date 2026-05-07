"use client";

import useUser from "@/lib/swr/use-user";
import { Button, Modal } from "@repo/ui";
import { useState } from "react";
import { toast } from "sonner";
import { Label, Input } from "@repo/ui";

export default function Password() {
  const { user, loading, mutate } = useUser();
  const [showModal, setShowModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPassword = user?.hasPassword ?? false;
  const provider = user?.provider;

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const method = hasPassword ? "PUT" : "POST";
      const body = hasPassword
        ? { currentPassword, newPassword }
        : { newPassword };

      const response = await fetch("/api/account/password", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save password");
      }

      toast.success(
        hasPassword
          ? "Password updated successfully"
          : "Password created successfully"
      );
      mutate();
      setShowModal(false);
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save password"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const providerLabel = provider
    ? provider.charAt(0).toUpperCase() + provider.slice(1)
    : null;

  return (
    <>
      <Modal showModal={showModal} setShowModal={setShowModal}>
        <div className="flex flex-col">
          <div className="border-b border-neutral-200 px-3 py-2">
            <h3 className="text-base font-display font-semibold text-neutral-700">
              {hasPassword ? "Update Password" : "Create Password"}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className=" ">
            <div className="space-y-4 px-3 py-2 ">
              {hasPassword && (
                <div>
                  <Label className="mb-1.5 block text-sm font-medium font-display text-neutral-700">
                    Current Password
                  </Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="h-fit p-0 py-1 px-2"
                    placeholder="Enter current password"
                  />
                </div>
              )}

              <div>
                <Label className="mb-1.5 block text-sm font-display font-medium text-neutral-700">
                  New Password
                </Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-fit p-0 py-1 px-2"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <Label className="mb-1.5 block text-sm font-display font-medium text-neutral-700">
                  Confirm New Password
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-fit p-0 py-1 px-2"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 py-2 border-t border-neutral-200">
              <div className="px-3 flex items-center gap-x-3">
                <Button
                  type="button"
                  variant="secondary"
                  text="Cancel"
                  className="h-fit font-display text-sm w-fit"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                />
                <Button
                  type="submit"
                  text={hasPassword ? "Update Password" : "Create Password"}
                  className="h-fit py-1.5 font-display text-[13px] w-fit text-white"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </form>
        </div>
      </Modal>

      <div className="">
        <div className="space-y-0.5">
          <h1 className="font-display text-sm font-medium text-[#5C5C5C]">
            Password
          </h1>
          <p className="text-sm text-neutral-500 font-display">
            {provider && !hasPassword ? (
              <>
                Your account is managed by{" "}
                <strong className="text-neutral-500">{providerLabel}</strong>.
                You can set a password to use with your Boilercode account.
              </>
            ) : hasPassword ? (
              "You have a password set. You can update it anytime."
            ) : (
              "Set a password to sign in with your email and password."
            )}
          </p>
        </div>
        <Button
          text={hasPassword ? "Update Password" : "Create Password"}
          className="mt-3 h-fit w-fit py-1 text-[14px] font-display text-[#868282] bg-[#f0efef]"
          disabled={loading}
          onClick={() => setShowModal(true)}
        />
      </div>
    </>
  );
}
