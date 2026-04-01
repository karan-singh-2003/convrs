import { ReactNode } from "react";
import { PLANS } from "./pricing";

export const PRICING_PLAN_COMPARE_FEATURES: {
  category: string;
  href?: string;
  features: {
    text:
      | string
      | ((d: { id: string; plan: (typeof PLANS)[number] }) => ReactNode);
    href?: string;
    check?:
      | boolean
      | {
          default?: boolean;
          free?: boolean;
          pro?: boolean;
          business?: boolean;
          advanced?: boolean;
          enterprise?: boolean;
        };
  }[];
}[] = [
  {
    category: "Core Platform",
    features: [
      {
        text: ({ id }) => (
          <>
            <strong>
              {
                {
                  free: "1",
                  pro: "3",
                  business: "10",
                  advanced: "25",
                  enterprise: "Unlimited",
                }[id]
              }
            </strong>{" "}
            {id === "free" ? "project" : "projects"}
          </>
        ),
      },
      {
        text: ({ id }) => (
          <>
            <strong>
              {
                {
                  free: "1",
                  pro: "3",
                  business: "10",
                  advanced: "25",
                  enterprise: "Unlimited",
                }[id]
              }
            </strong>{" "}
            {id === "free" ? "workspace" : "workspaces"}
          </>
        ),
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: "Custom branding",
      },
      {
        check: {
          free: false,
          pro: false,
          default: true,
        },
        text: "White-label options",
      },
      {
        check: {
          free: false,
          pro: false,
          business: false,
          advanced: true,
          enterprise: true,
        },
        text: "Custom domain",
      },
    ],
  },
  {
    category: "Team & Collaboration",
    features: [
      {
        text: ({ id }) => (
          <>
            <strong>
              {
                {
                  free: "1",
                  pro: "3",
                  business: "10",
                  advanced: "25",
                  enterprise: "Unlimited",
                }[id]
              }
            </strong>{" "}
            {id === "free" ? "team member" : "team members"}
          </>
        ),
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: "Team roles & permissions",
      },
      {
        check: {
          free: false,
          pro: false,
          default: true,
        },
        text: "Custom roles",
      },
      {
        check: {
          free: false,
          pro: false,
          default: true,
        },
        text: "Activity tracking",
      },
      {
        check: {
          free: false,
          pro: false,
          business: false,
          advanced: true,
          enterprise: true,
        },
        text: "Advanced collaboration tools",
      },
    ],
  },
  {
    category: "Security & Access",
    features: [
      {
        text: "Two-factor authentication",
      },
      {
        check: {
          free: false,
          default: true,
        },
        text: "Role-based access control",
      },
      {
        check: {
          free: false,
          pro: false,
          default: true,
        },
        text: "Audit logs",
      },
      {
        check: {
          free: false,
          pro: false,
          business: false,
          advanced: true,
          enterprise: true,
        },
        text: "SAML/SSO authentication",
      },
      {
        check: {
          free: false,
          pro: false,
          business: false,
          advanced: true,
          enterprise: true,
        },
        text: "Advanced security policies",
      },
    ],
  },
  {
    category: "Integrations",
    features: [
      {
        check: {
          free: false,
          default: true,
        },
        text: "API access",
      },
      {
        check: {
          free: false,
          pro: false,
          default: true,
        },
        text: "Webhooks",
      },
      {
        text: ({ id }) => (
          <>
            <strong>
              {
                {
                  free: "5",
                  pro: "25",
                  business: "100",
                  advanced: "500",
                  enterprise: "Unlimited",
                }[id]
              }
            </strong>{" "}
            environment variables
          </>
        ),
      },
      {
        check: {
          free: false,
          pro: false,
          business: false,
          advanced: true,
          enterprise: true,
        },
        text: "Custom integrations",
      },
    ],
  },
  {
    category: "Support",
    features: [
      {
        text: ({ id }) => (
          <>
            <strong>
              {
                {
                  free: "Community support",
                  pro: "Email support",
                  business: "Priority support",
                  advanced: "24/7 priority support",
                  enterprise: "Dedicated 24/7 support",
                }[id]
              }
            </strong>
          </>
        ),
      },
      {
        check: {
          free: false,
          pro: false,
          default: true,
        },
        text: "Dedicated support channel",
      },
      {
        check: {
          free: false,
          pro: false,
          business: false,
          advanced: true,
          enterprise: true,
        },
        text: "Dedicated account manager",
      },
      {
        check: {
          free: false,
          pro: false,
          business: false,
          advanced: true,
          enterprise: true,
        },
        text: "Custom onboarding",
      },
    ],
  },
];
