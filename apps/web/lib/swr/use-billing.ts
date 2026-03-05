"use client";
import useSWR from "swr";
import { fetcher } from "@repo/utils";
import useWorkspace from "./use-workspace";

export type BillingInvoice = {
  id: string;
  number: string | null;
  amountDue: number;
  amountPaid: number;
  status: string | null;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export type BillingSubscription = {
  id: string;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  interval: string;
};

export type BillingCustomer = {
  email: string | null;
  name: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
};

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  name: string | null;
  isDefault: boolean;
};

export type BillingData = {
  plan: string;
  planName: string;
  price: number;
  yearlyPrice: number;
  billingCycleStart: string;
  billingCycleEnd: string;
  subscription: BillingSubscription | null;
  invoices: BillingInvoice[];
  paymentFailedAt: string | null;
  customer: BillingCustomer | null;
  paymentMethods: PaymentMethod[];
};

export default function useBilling() {
  const { slug } = useWorkspace();

  const {
    data: billing,
    error,
    isLoading,
    mutate,
  } = useSWR<BillingData>(slug && `/api/workspaces/${slug}/billing`, fetcher, {
    dedupingInterval: 60000,
  });

  return {
    billing,
    error,
    loading: isLoading,
    mutate,
  };
}
