"use client";

import { Modal, Input, Button, ToggleGroup } from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";

function CreateAlertModal({
  showModal,
  setShowModal,
}: {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const params = useParams() as { slug?: string };

  const [alertName, setAlertName] = useState("");
  const [trigger, setTrigger] = useState("");

  const [view, setView] = useState<"editor" | "preview">("editor");
  const [subject, setSubject] = useState(
    "New {{goal_name}} from {{visitor_country}}"
  );

  const [content, setContent] = useState(`Hi {{first_name}},

{{visitor_name}} just completed {{goal_name}}

He is from {{country_name}} and discovered {{site_name}} using {{referrer_name}} and device {{device_name}}`);

  const [isLoading, setIsLoading] = useState(false);

  const resetEditor = useCallback(() => {
    setAlertName("");
    setTrigger("");
    setSubject("New {{goal_name}} from {{visitor_country}}");
    setContent(`Hi {{first_name}},

{{visitor_name}} just completed {{goal_name}}

He is from {{country_name}} and discovered {{site_name}} using {{referrer_name}} and device {{device_name}}`);
    setView("editor");
  }, []);

  const handleSave = async () => {
    if (!alertName.trim() || !content.trim()) return;
    if (!params.slug) {
      toast.error("Workspace not found.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${params.slug}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: alertName,
          trigger,
          subject,
          content,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create alert");
      }

      toast.success("Alert created!");
      setShowModal(false);
      resetEditor();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create alert."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      showModal={showModal}
      setShowModal={setShowModal}
      className="flex h-[85dvh] max-w-[900px] flex-col overflow-hidden p-0"
    >
      {/* Header */}
      <div className="shrink-0 border-b border-neutral-100 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-[15px] font-medium text-black/70">
            Create Alert
          </h3>
          <h1 className="font-display font-medium text-neutral-500 text-[13px]">
            Alerts are sent to : official.jaskaran13@gmail.com
          </h1>
        </div>
      </div>

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        {/* LEFT PANEL */}
        <div className="flex h-full flex-col overflow-hidden border-b border-neutral-100 md:border-b-0 md:border-r">
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
            {/* Alert Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13.5px] font-medium text-neutral-500">
                Alert name
              </label>
              <Input
                value={alertName}
                onChange={(e) => setAlertName(e.target.value)}
                placeholder="e.g. Onboarding alert"
              />
            </div>

            {/* Trigger */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13.5px] font-medium text-neutral-500">
                Trigger
              </label>
              <Input
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                placeholder="e.g. user.signup"
              />
              <h1 className="flex items-center my-2 gap-2 text-sm text-neutral-600 font-display font-medium hover:underline">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Add trigger
              </h1>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden p-4">
          {/* Toggle */}
          <div className="flex justify-center">
            <ToggleGroup
              selected={view}
              selectAction={(option) => setView(option as "editor" | "preview")}
              options={[
                { value: "editor", label: "Editor" },
                { value: "preview", label: "Preview" },
              ]}
              className="bg-neutral-50 w-full text-center border border-neutral-200"
              optionClassName="w-full px-3 py-1 text-center text-sm justify-center"
            />
          </div>

          <div className="bg-neutral-50 min-h-64 max-h-full flex-1 rounded-2xl my-5 p-1 overflow-hidden">
            <div className="flex h-full flex-col">
              <div className="flex items-center  px-3 border-b border-neutral-200/80">
                <h1 className="font-display text-sm font-medium text-neutral-500 whitespace-nowrap">
                  Subject
                </h1>
                {view === "editor" ? (
                  <input
                    type="text"
                    className="bg-transparent py-2 focus:ring-0 border-none font-medium font-display text-sm w-full"
                    placeholder="New {{goal_name}} from {{visitor_country}}"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                ) : (
                  <p className="py-2 font-display text-sm text-neutral-700 w-full truncate">
                    {subject || "No subject"}
                  </p>
                )}
              </div>

              <div className="min-h-0 flex-1 px-3 py-2">
                {view === "editor" ? (
                  <textarea
                    className="bg-transparent h-full w-full resize-none border-none p-0 font-display text-sm font-medium leading-6 focus:ring-0 overflow-y-auto"
                    placeholder="Write your alert message..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                ) : (
                  <div className="h-full w-full overflow-y-auto whitespace-pre-wrap break-words font-display text-sm font-medium text-neutral-600">
                    {content || "No content"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-100 px-5 py-3">
        <Button
          text="Cancel"
          variant="outline"
          onClick={() => {
            setShowModal(false);
            resetEditor();
          }}
          className="w-fit rounded-full"
        />

        <Button
          text={isLoading ? "Creating..." : "Create Alert"}
          onClick={handleSave}
          disabled={isLoading || !alertName.trim() || !content.trim()}
          className="w-fit rounded-full"
        />
      </div>
    </Modal>
  );
}

/* Hook */
export function useCreateAlertModal() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const CreateAlertModalComponent = useCallback(
    () => (
      <CreateAlertModal
        showModal={showCreateModal}
        setShowModal={setShowCreateModal}
      />
    ),
    [showCreateModal]
  );

  return useMemo(
    () => ({
      setShowCreateAlertModal: setShowCreateModal,
      CreateAlertModal: CreateAlertModalComponent,
    }),
    [CreateAlertModalComponent]
  );
}
