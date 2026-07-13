// apps/web/ui/workspaces/revenue/provider-config.tsx
// Shared types + constants for the Revenue settings page. Pulled out of the
// page component so every provider form / the selector / the connected state
// can import the same source of truth instead of redeclaring it.

export type Provider = "stripe" | "polar" | "lemonsqueezy" | "paddle" | "dodo";

export const PROVIDERS: { value: Provider; label: string; img: React.ReactNode }[] = [
  {
    value: "stripe", label: "Stripe", img: (
      <svg width="30" height="23" viewBox="0 0 16 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M6.105 6.54186C6.105 5.59999 6.88875 5.23561 8.15512 5.23561C10.251 5.2809 12.3077 5.81306 14.1625 6.79005V1.10443C12.2499 0.352791 10.21 -0.0218995 8.15512 0.000988729C3.27387 0.000988729 0 2.5578 0 6.82718C0 13.5069 9.17262 12.4221 9.17262 15.3013C9.17262 16.4274 8.21013 16.7767 6.85575 16.7767C4.85856 16.7767 2.27906 15.9503 0.25575 14.8503V20.6102C2.33888 21.5166 4.58468 21.9895 6.85644 22.0003C11.8731 22.0003 15.3312 19.5219 15.3312 15.1782C15.3312 7.96911 6.105 9.2568 6.105 6.54324V6.54186Z" fill="#6772E5" />
      </svg>
    )
  },
  {
    value: "polar", label: "Polar", img: (
      <svg width="30" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_1043_37)">
          <mask id="mask0_1043_37" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="22" height="22">
            <path d="M0 0H22V22H0V0Z" fill="white" />
          </mask>
          <g mask="url(#mask0_1043_37)">
            <path fillRule="evenodd" clipRule="evenodd" d="M4.87134 20.1127C9.89086 23.5105 16.7145 22.1958 20.1122 17.1764C23.5101 12.1569 22.1955 5.33328 17.1759 1.93553C12.1564 -1.46237 5.33283 -0.147722 1.93508 4.87172C-1.4629 9.89139 -0.148105 16.7151 4.87134 20.1127ZM3.51673 8.55614C2.26133 12.413 2.67985 16.2725 4.34466 18.801C1.32289 15.9401 0.533455 11.0229 2.70911 6.77032C4.10032 4.05098 6.42139 2.1559 8.98322 1.34586C6.64322 2.69248 4.58732 5.2667 3.51673 8.55614ZM12.8587 20.7637C15.5009 19.9914 17.9088 18.0686 19.3369 15.2773C21.494 11.0608 20.7363 6.19092 17.7779 3.31992C19.3761 5.84962 19.7613 9.64675 18.5262 13.4414C17.4251 16.8245 15.2815 19.4512 12.8587 20.7637ZM13.4659 19.5238C15.2493 17.9977 16.7211 15.4446 17.3752 12.3783C18.409 7.53116 17.0537 3.02152 14.3082 1.51665C15.7644 3.47597 16.5016 7.2816 16.047 11.5381C15.6995 14.7934 14.7263 17.6438 13.4659 19.5238ZM4.67253 9.6689C3.63113 14.5519 5.01427 19.0923 7.80072 20.5634C6.30633 18.6277 5.54374 14.778 6.0042 10.4658C6.346 7.2643 7.29296 4.45438 8.52312 2.57412C6.76628 4.10576 5.31933 6.6362 4.67253 9.6689ZM14.6544 10.9681C14.7332 15.9484 13.1699 20.0114 11.1629 20.043C9.15584 20.0747 7.46507 16.0632 7.38638 11.083C7.3077 6.1027 8.87094 2.03966 10.878 2.00798C12.885 1.9763 14.5758 5.98786 14.6544 10.9681Z" fill="#363636" />
          </g>
        </g>
        <defs><clipPath id="clip0_1043_37"><rect width="22" height="22" fill="white" /></clipPath></defs>
      </svg>
    )
  },
  {
    value: "lemonsqueezy", label: "LemonSqueezy", img: (
      <svg width="30" height="22" viewBox="0 0 16 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M5.41132 13.5028L11.2775 16.2313C12.0046 16.5697 12.5178 17.1375 12.795 17.7888C13.496 19.4383 12.5379 21.1252 11.0339 21.7319C9.52953 22.3383 7.92632 21.948 7.19733 20.2328L4.64435 14.2107C4.44652 13.7439 4.9435 13.2852 5.41132 13.5028ZM5.76295 11.7365L11.8185 9.43365C13.831 8.66829 16.0294 10.1164 15.9997 12.2205C15.9992 12.248 15.9988 12.2755 15.9981 12.3032C15.9546 14.3522 13.8173 15.7293 11.849 15.0045L5.76869 12.7656C5.28366 12.5871 5.28008 11.9202 5.76295 11.7365ZM5.42395 10.9389L11.3767 8.39424C13.3548 7.54855 13.8568 5.0104 12.3076 3.54387C12.2873 3.52459 12.2669 3.50543 12.2464 3.48639C10.7275 2.06803 8.21661 2.56742 7.35189 4.43561L4.68064 10.2075C4.46751 10.6678 4.9492 11.1418 5.42395 10.9389ZM3.89204 9.93335L6.05629 3.96321C6.32461 3.22296 6.27491 2.46806 5.99751 1.81671C5.29505 0.167968 3.39268 -0.364236 1.88884 0.243365C0.385249 0.851201 -0.464391 2.23163 0.266022 3.94623L2.83573 9.96172C3.035 10.4279 3.71954 10.4095 3.89204 9.93335Z" fill="#FFC233" />
      </svg>
    )
  },
  {
    value: "paddle", label: "Paddle", img: (
      <svg width="30" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" fill="#FFD400" />
        <path d="M6 11.4101V12.5816C7.07699 12.5799 8.13038 12.8967 9.02744 13.4921C9.92449 14.0876 10.6251 14.935 11.0409 15.9276C11.3143 16.5843 11.4552 17.2894 11.4538 18H12.5462C12.5462 16.565 13.1207 15.1894 14.1441 14.1752C15.1696 13.159 16.5556 12.5892 18 12.5899V11.4184C16.9234 11.4185 15.8707 11.101 14.9739 10.5058C14.0772 9.91053 13.3763 9.06404 12.9591 8.07244C12.6855 7.41576 12.5451 6.71131 12.5462 6H11.4538C11.4538 7.43498 10.8793 8.81062 9.85591 9.82477C8.83059 10.8412 7.44442 11.4111 6 11.4101Z" fill="#161616" />
      </svg>
    )
  },
  // {
  //   value: "dodo", label: "Dodo Payments", img: (
  //     <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  //       <rect width="30" height="32" fill="#C6FE1E" />
  //       <mask id="mask0_0_1" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="4" y="5" width="16" height="14">
  //         <path d="M20 5H4V18.3333H20V5Z" fill="white" />
  //       </mask>
  //       <g mask="url(#mask0_0_1)">
  //         <path d="M10.1935 8.07666H10.1864C9.74552 7.95008 9.27903 8.20324 9.1297 8.62137C8.96472 9.07079 9.22641 9.58564 9.68863 9.72786C10.8207 10.0493 11.3071 8.42653 10.1935 8.07666Z" fill="#0D0D0D" />
  //         <path d="M19.8417 10.3701C18.3839 7.17723 13.7332 8.49847 13.3037 7.6622C12.0451 5.68674 9.69555 4.5774 7.15547 5.14914C6.76435 4.99269 5.41751 4.95003 4.54711 5.49758L5.07191 5.7294C5.11173 5.74647 5.10035 5.7422 5.15867 5.76354C5.39618 5.85314 5.35493 5.82754 5.18427 5.9214C4.79315 6.15038 4.30533 6.41634 4.00098 6.81598C4.01378 6.83447 4.67084 6.99234 4.67084 6.99234C4.68222 6.99518 4.80453 7.00798 4.77751 7.06202C2.62853 10.4554 6.25235 15.5769 8.01164 18.3331H13.1046C12.3181 16.9251 11.4193 15.0037 11.7265 13.6995C11.782 13.4634 11.8531 13.1634 12.1432 13.1235C12.8444 13.0112 13.783 13.0211 14.4515 12.9458H14.4614C14.6036 12.9386 18.0852 12.4963 18.9187 14.6666C18.9898 14.8658 19.1533 14.7363 19.2188 14.6055C19.8403 13.3696 20.2413 11.424 19.8445 10.3715L19.8417 10.3701ZM14.2211 9.32194C13.9764 9.75856 13.81 10.326 13.7674 10.821C13.7446 11.1353 13.7773 11.4453 13.8086 11.7596C13.8257 11.9331 13.8271 12.1522 13.6877 12.2659C13.5668 12.3683 13.3663 12.3783 13.1644 12.3925C12.1731 12.3882 9.75529 12.3925 8.82373 11.7582L8.81804 11.7539C7.46267 10.9276 6.73733 9.06167 7.54231 7.61243C7.80258 7.12034 8.28187 6.80034 8.828 6.67945C9.53058 6.51874 10.3043 6.6382 10.9315 6.96674C11.1875 7.09616 11.4932 7.26683 11.7265 7.46309C12.1887 7.867 12.5841 8.28656 13.19 8.41598C13.4687 8.49562 13.7588 8.48425 14.0376 8.54114C14.5596 8.66629 14.4287 8.96354 14.2196 9.31909L14.2211 9.32194Z" fill="#0D0D0D" />
  //       </g>
  //     </svg>
  //   )
  // },
];

export const CONNECT_URLS: Record<Provider, string> = {
  stripe:
    "https://dashboard.stripe.com/apikeys/create" +
    "?name=Convrs" +
    "&permissions[]=rak_charge_read&permissions[]=rak_subscription_read" +
    "&permissions[]=rak_customer_read&permissions[]=rak_payment_intent_read" +
    "&permissions[]=rak_checkout_session_read&permissions[]=rak_invoice_read" +
    "&permissions[]=rak_webhook_write&permissions[]=rak_product_read",
  polar: "https://polar.sh/dashboard",
  lemonsqueezy: "https://app.lemonsqueezy.com/settings/api",
  paddle: "https://vendors.paddle.com/authentication",
  dodo: "https://app.dodopayments.com/",
};

// Field state kept generic so every provider can reuse the same form —
// each provider only reads the subset it needs when building the connect payload.
export type FormState = {
  apiKey: string;
  webhookSecret: string;
  organizationId: string; // polar
  storeId: string;        // lemonsqueezy
};

export const EMPTY_FORM: FormState = {
  apiKey: "",
  webhookSecret: "",
  organizationId: "",
  storeId: "",
};

export function buildConnectPayload(provider: Provider, form: FormState): Record<string, string> {
  switch (provider) {
    case "polar":
      return { organizationId: form.organizationId, apiKey: form.apiKey };
    case "lemonsqueezy":
      return { storeId: form.storeId, apiKey: form.apiKey };
    case "paddle":
      return { apiKey: form.apiKey };
    case "dodo":
      return { apiKey: form.apiKey, webhookSecret: form.webhookSecret };
    case "stripe":
    default:
      return { apiKey: form.apiKey };
  }
}

export function isFormValid(provider: Provider, form: FormState): boolean {
  switch (provider) {
    case "polar":
      return !!form.organizationId.trim() && !!form.apiKey.trim();
    case "lemonsqueezy":
      return !!form.storeId.trim() && !!form.apiKey.trim();
    case "dodo":
      return !!form.webhookSecret.trim(); // apiKey optional for dodo
    case "paddle":
    case "stripe":
    default:
      return !!form.apiKey.trim();
  }
}