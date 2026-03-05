import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Modal, Button, Input } from "@repo/ui";

const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "Singapore",
  "UAE",
];

export type BillingFormData = {
  email: string;
  company: string;
  address1: string;
  address2: string;
  country: string;
  city: string;
  postalCode: string;
  state: string;
  gst: string;
};

export type PaymentFormData = BillingFormData & {
  fullName: string;
  cardNumber: string;
};

export type EditBillingModalProps = {
  showEditBillingModal: boolean;
  setShowEditBillingModal: Dispatch<SetStateAction<boolean>>;
  mode?: "billing" | "payment";
  initialData?: Partial<BillingFormData>;
  onSubmit?: (data: BillingFormData | PaymentFormData) => void | Promise<void>;
  loading?: boolean;
};

const defaultBillingData: BillingFormData = {
  email: "",
  company: "",
  address1: "",
  address2: "",
  country: "India",
  city: "",
  postalCode: "",
  state: "",
  gst: "",
};

function EditBillingModal({
  showEditBillingModal,
  setShowEditBillingModal,
  mode = "billing",
  initialData,
  onSubmit,
  loading = false,
}: EditBillingModalProps) {
  const [form, setForm] = useState<PaymentFormData>({
    ...defaultBillingData,
    fullName: "",
    cardNumber: "",
    ...initialData,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  const isPayment = mode === "payment";
  const title = isPayment ? "Add payment method" : "Update billing details";
  const buttonText = isPayment
    ? "Add payment method"
    : "Update billing details";

  return (
    <Modal
      showModal={showEditBillingModal}
      setShowModal={setShowEditBillingModal}
      className="w-[800px] h-fit"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-2">
          <div>
            <h3 className="text-base font-medium text-neutral-700 font-display">
              {title}
            </h3>
          </div>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Payment-only: Full Name + Card Number */}
          {isPayment && (
            <>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-neutral-500 font-display">
                  Full Name{" "}
                  <span className="text-neutral-400 font-normal">
                    (required)
                  </span>
                </label>
                <Input
                  name="fullName"
                  value={form.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  placeholder="Name on card"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-neutral-500 font-display">
                  Card Number{" "}
                  <span className="text-neutral-400 font-normal">
                    (required)
                  </span>
                </label>
                <Input
                  name="cardNumber"
                  value={form.cardNumber}
                  onChange={(e) => handleChange("cardNumber", e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  className="h-9"
                />
              </div>
            </>
          )}

          {/* Billing Email */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-neutral-500 font-display">
              Billing Email{" "}
              <span className="text-neutral-400 font-normal">(required)</span>
            </label>
            <Input
              name="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-neutral-500 font-display">
              Company{" "}
              <span className="text-neutral-400 font-normal">(required)</span>
            </label>
            <Input
              name="company"
              value={form.company}
              onChange={(e) => handleChange("company", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Address Line 1 */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-neutral-500 font-display">
              Address Line 1{" "}
              <span className="text-neutral-400 font-normal">(required)</span>
            </label>
            <Input
              name="address1"
              value={form.address1}
              onChange={(e) => handleChange("address1", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Address Line 2 */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-neutral-500 font-display">
              Address Line 2
            </label>
            <Input
              name="address2"
              value={form.address2}
              onChange={(e) => handleChange("address2", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Country + City row */}
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-neutral-500 font-display">
                Country{" "}
                <span className="text-neutral-400 font-normal">(required)</span>
              </label>
              <select
                name="country"
                value={form.country}
                onChange={(e) => handleChange("country", e.target.value)}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-neutral-500 font-display">
                City{" "}
                <span className="text-neutral-400 font-normal">(required)</span>
              </label>
              <Input
                name="city"
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Postal Code + State + GST row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-neutral-500 font-display">
                Postal Code
              </label>
              <Input
                name="postalCode"
                value={form.postalCode}
                onChange={(e) => handleChange("postalCode", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-neutral-500 font-display">
                State
              </label>
              <Input
                name="state"
                value={form.state}
                onChange={(e) => handleChange("state", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-neutral-500 font-display">
                GST number
              </label>
              <Input
                name="gst"
                value={form.gst}
                onChange={(e) => handleChange("gst", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4">
          <Button
            text={buttonText}
            className="px-4 font-display text-sm font-medium text-white"
            onClick={handleSubmit}
            loading={submitting || loading}
          />
        </div>
      </div>
    </Modal>
  );
}

export function useEditBillingModal({
  mode = "billing",
  initialData,
  onSubmit,
}: {
  mode?: "billing" | "payment";
  initialData?: Partial<BillingFormData>;
  onSubmit?: (data: BillingFormData | PaymentFormData) => void | Promise<void>;
} = {}) {
  const [showEditBillingModal, setShowEditBillingModal] = useState(false);

  const EditBillingModalCallback = useCallback(() => {
    return (
      <EditBillingModal
        showEditBillingModal={showEditBillingModal}
        setShowEditBillingModal={setShowEditBillingModal}
        mode={mode}
        initialData={initialData}
        onSubmit={onSubmit}
      />
    );
  }, [
    showEditBillingModal,
    setShowEditBillingModal,
    mode,
    initialData,
    onSubmit,
  ]);

  return useMemo(
    () => ({
      setShowEditBillingModal,
      EditBillingModal: EditBillingModalCallback,
    }),
    [setShowEditBillingModal, EditBillingModalCallback]
  );
}
