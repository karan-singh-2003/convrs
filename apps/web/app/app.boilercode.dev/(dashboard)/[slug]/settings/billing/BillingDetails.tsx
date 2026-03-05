import { Button } from "@repo/ui";
import {
  useEditBillingModal,
  BillingFormData,
} from "@/ui/modals/billing-edit-modal";
import useBilling from "@/lib/swr/use-billing";
import useWorkspace from "@/lib/swr/use-workspace";
import { useCallback, useMemo } from "react";
import { fetcher } from "@repo/utils";
import { toast } from "sonner";

export default function BillingDetails() {
  const { slug } = useWorkspace();
  const { billing, loading, mutate } = useBilling();
  const customer = billing?.customer;

  const initialData: Partial<BillingFormData> = useMemo(
    () => ({
      email: customer?.email ?? "",
      company: customer?.name ?? "",
      address1: customer?.address?.line1 ?? "",
      address2: customer?.address?.line2 ?? "",
      country: customer?.address?.country ?? "India",
      city: customer?.address?.city ?? "",
      postalCode: customer?.address?.postal_code ?? "",
      state: customer?.address?.state ?? "",
      gst: customer?.address?.line1 ?? "",
    }),
    [customer]
  );

  const onSubmit = useCallback(
    async (data: BillingFormData) => {
      try {
        await fetcher(`/api/workspaces/${slug}/billing`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        toast.success("Billing details updated");
        mutate();
        setShowEditBillingModal(false);
      } catch (err) {
        toast.error("Failed to update billing details");
      }
    },
    [slug, mutate]
  );

  const { EditBillingModal, setShowEditBillingModal } = useEditBillingModal({
    mode: "billing",
    initialData,
    onSubmit: onSubmit as any,
  });

  const details = useMemo(() => {
    if (!customer) return {};
    const addr = customer.address;
    const addressParts = [
      addr?.line1,
      addr?.line2,
      addr?.city,
      addr?.state,
      addr?.postal_code,
      addr?.country,
    ].filter(Boolean);

    return {
      Email: customer.email ?? "—",
      "Company Name": customer.name ?? "—",
      Address: addressParts.length > 0 ? addressParts.join(" ") : "—",
        GSTIN: customer.address?.line1 ?? "—",
    };
  }, [customer]);

  const entries = Object.entries(details);
  const lastIndex = entries.length - 1;

  return (
    <>
      <EditBillingModal />
      <div className="w-full bg-neutral-50 py-3 rounded-2xl">
        <div className="flex items-center px-4 justify-between">
          <div>
            <h3 className="text-sm font-medium font-display text-neutral-500">
              Address
            </h3>
            <p className="text-[14px] font-display text-neutral-500">
              Update your billing address
            </p>
          </div>
          <Button
            variant="secondary"
            text="Edit"
            className="font-medium w-fit font-display text-[13px] bg-transparent text-neutral-600"
            onClick={() => setShowEditBillingModal(true)}
          />
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="px-4 py-2 text-sm text-neutral-400 font-display">
              Loading...
            </div>
          ) : entries.length > 0 ? (
            entries.map(([label, value], index) => (
              <DetailRow
                key={label}
                label={label}
                value={value}
                isLast={index === lastIndex}
              />
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-neutral-400 font-display">
              No billing details yet
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DetailRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 px-4 pb-2 ${
        !isLast ? "border-b border-neutral-200/70" : ""
      }`}
    >
      <span className="font-medium font-display text-neutral-500 text-sm">
        {label}
      </span>
      <span className="font-display text-sm text-neutral-500 text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
