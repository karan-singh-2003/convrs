import { Plus, CreditCard, Trash2 } from "lucide-react";
import {
  useEditBillingModal,
  PaymentFormData,
} from "@/ui/modals/billing-edit-modal";
import useBilling, {
  PaymentMethod as PaymentMethodType,
} from "@/lib/swr/use-billing";
import useWorkspace from "@/lib/swr/use-workspace";
import { useCallback, useState } from "react";
import { fetcher } from "@repo/utils";
import { toast } from "sonner";

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  diners: "Diners",
  jcb: "JCB",
  unionpay: "UnionPay",
  unknown: "Card",
};

export default function PaymentMethod() {
  const { slug } = useWorkspace();
  const { billing, loading, mutate } = useBilling();
  const paymentMethods = billing?.paymentMethods ?? [];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (data: PaymentFormData) => {
      // Parse expiry from card number field — for now we send raw
      // In a real implementation you'd use Stripe Elements, but this uses the API directly
      try {
        await fetcher(`/api/workspaces/${slug}/billing/payment-methods`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardNumber: data.cardNumber.replace(/\s/g, ""),
            expMonth: new Date().getMonth() + 1, // placeholder — user would provide
            expYear: new Date().getFullYear() + 3, // placeholder
            cvc: "000", // placeholder — real implementation would use Stripe Elements
            fullName: data.fullName,
            email: data.email,
            address: {
              line1: data.address1,
              line2: data.address2,
              city: data.city,
              state: data.state,
              postal_code: data.postalCode,
              country: data.country,
            },
          }),
        });
        toast.success("Payment method added");
        mutate();
        setShowEditBillingModal(false);
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to add payment method");
      }
    },
    [slug, mutate]
  );

  const handleDelete = useCallback(
    async (paymentMethodId: string) => {
      setDeletingId(paymentMethodId);
      try {
        await fetcher(`/api/workspaces/${slug}/billing/payment-methods`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethodId }),
        });
        toast.success("Payment method removed");
        mutate();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to remove payment method");
      } finally {
        setDeletingId(null);
      }
    },
    [slug, mutate]
  );

  const { EditBillingModal, setShowEditBillingModal } = useEditBillingModal({
    mode: "payment",
    initialData: {
      email: billing?.customer?.email ?? "",
      company: billing?.customer?.name ?? "",
      address1: billing?.customer?.address?.line1 ?? "",
      address2: billing?.customer?.address?.line2 ?? "",
      country: billing?.customer?.address?.country ?? "India",
      city: billing?.customer?.address?.city ?? "",
      postalCode: billing?.customer?.address?.postal_code ?? "",
      state: billing?.customer?.address?.state ?? "",
    },
    onSubmit: onSubmit as any,
  });

  return (
    <>
      <EditBillingModal />
      <div className="rounded-2xl flex flex-col bg-neutral-50 min-h-64 w-full p-4">
        <div className="flex items-center w-full justify-between">
          <div>
            <h1 className="font-medium font-display text-neutral-500 text-[14.5px]">
              Payment
            </h1>
            <h1 className="font-display text-[13.5px] text-neutral-500">
              Manage your payment methods
            </h1>
          </div>
          <button
            onClick={() => setShowEditBillingModal(true)}
            className="p-1 rounded-md hover:bg-neutral-200/60 transition text-neutral-600"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Payment methods list */}
        <div className="mt-4 flex-1 space-y-2">
          {loading ? (
            <p className="text-sm text-neutral-400 font-display">Loading...</p>
          ) : paymentMethods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CreditCard
                size={28}
                className="text-neutral-300 rounded-full mb-2"
              />
              <p className="text-sm text-neutral-400 font-display">
                No payment methods
              </p>
              <button
                onClick={() => setShowEditBillingModal(true)}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-display font-medium"
              >
                Add one now
              </button>
            </div>
          ) : (
            paymentMethods.map((pm) => (
              <PaymentCard
                key={pm.id}
                pm={pm}
                onDelete={handleDelete}
                deleting={deletingId === pm.id}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function PaymentCard({
  pm,
  onDelete,
  deleting,
}: {
  pm: PaymentMethodType;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center justify-between ">
      <div className="flex items-center gap-3">
        {/* <div className="flex h-8 w-12 items-center justify-center rounded-full bg-neutral-100">
          <CreditCard size={15} className="text-neutral-500" />
        </div> */}
        <div>
          <p className="text-[13px] font-medium font-display text-neutral-600">
            {CARD_BRAND_LABELS[pm.brand] ?? pm.brand} •••• {pm.last4}
            {pm.isDefault && (
              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-500">
                Default
              </span>
            )}
          </p>
          <p className="text-[13px] font-display text-neutral-400">
            {pm.name ? `${pm.name} · ` : ""}Expires{" "}
            {pm.expMonth.toString().padStart(2, "0")}/{pm.expYear}
          </p>
        </div>
      </div>
      <button
        onClick={() => onDelete(pm.id)}
        disabled={deleting}
        className="rounded-md p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
          />
        </svg>
      </button>
    </div>
  );
}
