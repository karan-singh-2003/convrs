// "use client";
// import useWorkspace from "@/lib/swr/use-workspace";
// import useStripeIntegration from "@/lib/swr/use-stripe-integration";
// import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
// import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
// import { Button, Input, ToggleGroup } from "@repo/ui";
// import Link from "next/link";
// import React, { useState } from "react";
// import { toast } from "sonner";
// import { LoadingSpinner } from "@repo/ui";

// export default function RevenueSettingsPage() {
//   const [apiKey, setApiKey] = useState("");
//   const [provider, setProvider] = useState<"dodo" | "stripe" | "Polar">(
//     "dodo"
//   );
//   const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
//     "idle"
//   );
//   const [error, setError] = useState("");
//   const [disconnecting, setDisconnecting] = useState(false);

//   const { id } = useWorkspace();
//   const { connected, loading, mutate } = useStripeIntegration();

//   async function handleConnect() {
//     setStatus("loading");
//     setError("");
//     try {
//       const res = await fetch("/api/integrations/stripe/connect", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ apiKey, workspaceId: id }),
//       });
//       const data = await res.json();

//       if (!res.ok) {
//         const message = data.error || "Failed to connect";
//         toast.error(message);
//         setError(message);
//         setStatus("error");
//         return;
//       }

//       setStatus("done");
//       toast.success("Stripe connected");
//       setApiKey("");
//       await mutate();
//     } catch (e: any) {
//       setError(e.message);
//       setStatus("error");
//     }
//   }

//   async function handleDisconnect() {
//     if (!id) return;

//     setDisconnecting(true);
//     setError("");

//     try {
//       const res = await fetch("/api/integrations/stripe", {
//         method: "DELETE",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ workspaceId: id }),
//       });
//       const data = await res.json();

//       if (!res.ok) {
//         const message = data.error || "Failed to disconnect";
//         toast.error(message);
//         setError(message);
//         return;
//       }

//       toast.success("Stripe disconnected");
//       await mutate();
//     } catch (e: any) {
//       const message = e.message || "Failed to disconnect";
//       setError(message);
//       toast.error(message);
//     } finally {
//       setDisconnecting(false);
//     }
//   }

//   return (
//     <PageWidthWrapper>
//       <SettingsChildrenLayout
//         title="Revenue"
//         description="Get insights into your revenue streams, track performance, and make data-driven decisions to grow your business with our comprehensive revenue analytics tools."
//       >
//         <div className="rounded-3xl bg-neutral-50 ">
//           <ToggleGroup
//             selected={provider}
//             selectAction={(value) => setProvider(value as "dodo" | "stripe")}
//             className="bg-neutral-100 w-full text-center border border-neutral-200"
//             optionClassName="w-full px-3 py-1 text-center text-sm justify-center"
//             options={[
//               {
//                 value: "dodo",

//                 label: (
//                   <span className="flex items-center gap-2">
//                     <svg
//                       width="36"
//                       height="36"
//                       viewBox="0 0 126 126"
//                       fill="none"
//                       xmlns="http://www.w3.org/2000/svg"
//                       className="size-7 rounded-md corner-superellipse/1.25"
//                     >
//                       <rect width="125.378" height="125.338"></rect>
//                       <path
//                         d="M62.689 0C28.069 0 0 28.059 0 62.669C0 97.279 28.068 125.338 62.69 125.338C97.31 125.338 125.378 97.279 125.378 62.668C125.378 28.058 97.31 0 62.689 0Z"
//                         fill="#C6FE1E"
//                       ></path>
//                       <path
//                         d="M55.2079 46.274H55.1659C52.5759 45.531 49.8339 47.018 48.9559 49.474C47.9859 52.115 49.5239 55.14 52.2409 55.976C58.8939 57.864 61.7529 48.33 55.2079 46.274Z"
//                         fill="#0D0D0D"
//                       ></path>
//                       <path
//                         d="M111.912 59.753C103.345 40.993 76.0124 48.756 73.4884 43.843C66.0914 32.236 52.2824 25.719 37.3544 29.078C35.0554 28.158 27.1404 27.908 22.0244 31.125L25.1094 32.487C25.3434 32.587 25.2764 32.562 25.6194 32.687C27.0144 33.214 26.7724 33.064 25.7694 33.615C23.4704 34.96 20.6034 36.523 18.8154 38.871C18.8904 38.979 22.7524 39.907 22.7524 39.907C22.8184 39.924 23.5374 39.999 23.3794 40.317C10.7494 60.254 32.0464 90.343 42.3864 106.537H72.3184C67.6954 98.265 62.4134 86.976 64.2184 79.313C64.5444 77.926 64.9624 76.163 66.6674 75.929C70.7884 75.269 76.3054 75.328 80.2334 74.885H80.2924C81.1284 74.843 101.589 72.244 106.487 84.995C106.905 86.165 107.867 85.405 108.251 84.636C111.904 77.375 114.261 65.944 111.929 59.761L111.912 59.753ZM78.8794 53.594C77.4424 56.159 76.4644 59.494 76.2134 62.401C76.0794 64.248 76.2714 66.069 76.4554 67.916C76.5564 68.935 76.5644 70.222 75.7454 70.891C75.0344 71.492 73.8564 71.551 72.6694 71.634C66.8434 71.609 52.6334 71.634 47.1594 67.908L47.1254 67.883C39.1594 63.028 34.8964 52.065 39.6274 43.55C41.1574 40.66 43.9744 38.779 47.1844 38.069C51.3134 37.124 55.8604 37.826 59.5464 39.757C61.0504 40.517 62.8484 41.52 64.2184 42.673C66.9354 45.046 69.2584 47.511 72.8194 48.271C74.4584 48.739 76.1634 48.672 77.8014 49.007C80.8694 49.742 80.1004 51.488 78.8714 53.577L78.8794 53.594Z"
//                         fill="#0D0D0D"
//                       ></path>
//                     </svg>
//                     <span>Dodo Payments</span>
//                     {/* <span className="text-[10px] px-2 py-0.5 rounded-full font-display bg-neutral-200 text-neutral-600">
//                       Coming Soon
//                     </span> */}
//                   </span>
//                 ),
//               },
//               {
//                 value: "stripe",
//                 label: (
//                   <span className="flex items-center gap-2">
//                     <svg
//                       width="40"
//                       height="40"
//                       viewBox="0 0 400 400"
//                       fill="none"
//                       xmlns="http://www.w3.org/2000/svg"
//                       className="size-6 rounded-md corner-superellipse/1.25"
//                     >
//                       <circle cx="200" cy="200" r="200" fill="#635BFF"></circle>
//                       <path
//                         d="M184.401 155.5C184.401 146.1 192.101 142.4 204.901 142.4C223.301 142.4 246.501 148 264.901 157.9V101.1C244.801 93.1 225.001 90 205.001 90C155.901 90 123.301 115.6 123.301 158.4C123.301 225.1 215.201 214.5 215.201 243.3C215.201 254.4 205.501 258 192.001 258C171.901 258 146.301 249.8 126.001 238.7V296.2C148.501 305.9 171.201 310 192.001 310C242.301 310 276.901 285.1 276.901 241.8C276.501 169.8 184.401 182.6 184.401 155.5Z"
//                         fill="white"
//                       ></path>
//                     </svg>
//                     <span>Stripe</span>
//                   </span>
//                 ),
//               },
//             ]}
//           />

//           <div className="mt-4 rounded-2xl  bg-white p-4 sm:p-5">
//             {provider === "dodo" ? (
//               <>
//                 <div className="flex flex-col items-center justify-center py-5 font-display text-center">
//                   <h2 className="text-base font-medium text-neutral-600">
//                     Dodo Payments
//                   </h2>
//                   <p className="mt-2 text-sm text-neutral-500 max-w-sm">
//                     Dodo integration is currently under development and will be
//                     available soon.
//                   </p>

//                   <div className="mt-4 px-4 py-2 rounded-full bg-neutral-100 text-neutral-600 text-sm font-medium">
//                     Coming Soon
//                   </div>
//                 </div>
//               </>
//             ) : loading ? (
//               <div className="py-4 text-sm font-medium text-neutral-500">
//                 <LoadingSpinner className="mx-auto" />
//               </div>
//             ) : connected ? (
//               <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//                 <h2 className="font-display text-[14.5px] font-medium text-neutral-600">
//                   You have connected Stripe account
//                 </h2>
//                 <Button
//                   text="Disconnect"
//                   variant="danger"
//                   className="h-7 w-fit rounded-full px-5 text-[13px] font-display"
//                   onClick={handleDisconnect}
//                   loading={disconnecting}
//                 />
//               </div>
//             ) : (
//               <div className="space-y-4">
//                 <>
//                   <div>
//                     <h2 className="font-display text-[15px] leading-tight font-medium text-neutral-600">
//                       Restricted API Key
//                     </h2>
//                     <p className="mt-1 text-sm font-display font-medium text-neutral-500">
//                       Create a restricted API Key and paste the API key below.
//                       Create from{" "}
//                       <Link
//                         href={STRIPE_CONNECT_URL}
//                         target="_blank"
//                         rel="noopener noreferrer"
//                         className="text-neutral-800 underline underline-offset-2"
//                       >
//                         Stripe Dashboard
//                       </Link>
//                       .
//                     </p>
//                   </div>

//                   <div className="flex flex-col gap-3 my-4 sm:flex-row sm:items-center">
//                     <Input
//                       placeholder="rk_live_***************"
//                       value={apiKey}
//                       onChange={(e) => setApiKey(e.target.value)}
//                       className="h-11 bg-neutral-50"
//                     />
//                     <Button
//                       text="Connect"
//                       className="h-11 w-full rounded-full px-6 sm:w-fit"
//                       onClick={handleConnect}
//                       loading={status === "loading"}
//                       disabled={!apiKey.trim() || status === "loading"}
//                     />
//                   </div>
//                 </>
//               </div>
//             )}
//           </div>

//           {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
//         </div>
//       </SettingsChildrenLayout>
//     </PageWidthWrapper>
//   );
// }

// export const STRIPE_CONNECT_URL =
//   "https://dashboard.stripe.com/apikeys/create" +
//   "?name=Analytics" +
//   "&permissions[]=rak_account_read" +
//   "&permissions[]=rak_charge_read" +
//   "&permissions[]=rak_subscription_read" +
//   "&permissions[]=rak_customer_read" +
//   "&permissions[]=rak_payment_intent_read" +
//   "&permissions[]=rak_checkout_session_read" +
//   "&permissions[]=rak_invoice_read" +
//   "&permissions[]=rak_webhook_write" +
//   "&permissions[]=rak_product_read";


// -----------------------------------------------------------------------------------------------------
// ---------------------------------version2------------------------------------------------------------.
// -----------------------------------------------------------------------------------------------------

// "use client";
// import useWorkspace from "@/lib/swr/use-workspace";
// import useIntegrations from "@/lib/swr/use-integration"; // returns Integration[] for the workspace
// import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
// import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
// import { Popover } from "@repo/ui"; // your existing component
// import { Button, Input, LoadingSpinner } from "@repo/ui";
// import { ArrowRight, Check, ChevronDown } from "lucide-react";
// import Link from "next/link";
// import { useState } from "react";
// import { toast } from "sonner";

// type Provider = "stripe" | "dodo" | "polar" | "lemonsqueezy" | "paddle";

// const PROVIDERS: { value: Provider; label: string; comingSoon?: boolean; img?: React.ReactNode }[] = [
//   {
//     value: "stripe", label: "Stripe", img: (
//       <svg width="30" height="20" viewBox="0 0 16 22" fill="none" xmlns="http://www.w3.org/2000/svg">
//         <path fill-rule="evenodd" clip-rule="evenodd" d="M6.105 6.54186C6.105 5.59999 6.88875 5.23561 8.15512 5.23561C10.251 5.2809 12.3077 5.81306 14.1625 6.79005V1.10443C12.2499 0.352791 10.21 -0.0218995 8.15512 0.000988729C3.27387 0.000988729 0 2.5578 0 6.82718C0 13.5069 9.17262 12.4221 9.17262 15.3013C9.17262 16.4274 8.21013 16.7767 6.85575 16.7767C4.85856 16.7767 2.27906 15.9503 0.25575 14.8503V20.6102C2.33888 21.5166 4.58468 21.9895 6.85644 22.0003C11.8731 22.0003 15.3312 19.5219 15.3312 15.1782C15.3312 7.96911 6.105 9.2568 6.105 6.54324V6.54186Z" fill="#6772E5" />
//       </svg>
//     )
//   },

//   {
//     value: "polar", label: "Polar", img: (
//       <svg width="30" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
//         <g clip-path="url(#clip0_1043_37)">
//           <mask id="mask0_1043_37" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="22" height="22">
//             <path d="M0 0H22V22H0V0Z" fill="white" />
//           </mask>
//           <g mask="url(#mask0_1043_37)">
//             <path fill-rule="evenodd" clip-rule="evenodd" d="M4.87134 20.1127C9.89086 23.5105 16.7145 22.1958 20.1122 17.1764C23.5101 12.1569 22.1955 5.33328 17.1759 1.93553C12.1564 -1.46237 5.33283 -0.147722 1.93508 4.87172C-1.4629 9.89139 -0.148105 16.7151 4.87134 20.1127ZM3.51673 8.55614C2.26133 12.413 2.67985 16.2725 4.34466 18.801C1.32289 15.9401 0.533455 11.0229 2.70911 6.77032C4.10032 4.05098 6.42139 2.1559 8.98322 1.34586C6.64322 2.69248 4.58732 5.2667 3.51673 8.55614ZM12.8587 20.7637C15.5009 19.9914 17.9088 18.0686 19.3369 15.2773C21.494 11.0608 20.7363 6.19092 17.7779 3.31992C19.3761 5.84962 19.7613 9.64675 18.5262 13.4414C17.4251 16.8245 15.2815 19.4512 12.8587 20.7637ZM13.4659 19.5238C15.2493 17.9977 16.7211 15.4446 17.3752 12.3783C18.409 7.53116 17.0537 3.02152 14.3082 1.51665C15.7644 3.47597 16.5016 7.2816 16.047 11.5381C15.6995 14.7934 14.7263 17.6438 13.4659 19.5238ZM4.67253 9.6689C3.63113 14.5519 5.01427 19.0923 7.80072 20.5634C6.30633 18.6277 5.54374 14.778 6.0042 10.4658C6.346 7.2643 7.29296 4.45438 8.52312 2.57412C6.76628 4.10576 5.31933 6.6362 4.67253 9.6689ZM14.6544 10.9681C14.7332 15.9484 13.1699 20.0114 11.1629 20.043C9.15584 20.0747 7.46507 16.0632 7.38638 11.083C7.3077 6.1027 8.87094 2.03966 10.878 2.00798C12.885 1.9763 14.5758 5.98786 14.6544 10.9681Z" fill="#363636" />
//           </g>
//         </g>
//         <defs>
//           <clipPath id="clip0_1043_37">
//             <rect width="22" height="22" fill="white" />
//           </clipPath>
//         </defs>
//       </svg>
//     )
//   },
//   {
//     value: "lemonsqueezy", label: "LemonSqueezy", img: (
//       <svg width="30" height="22" viewBox="0 0 16 22" fill="none" xmlns="http://www.w3.org/2000/svg">
//         <path fill-rule="evenodd" clip-rule="evenodd" d="M5.41132 13.5028L11.2775 16.2313C12.0046 16.5697 12.5178 17.1375 12.795 17.7888C13.496 19.4383 12.5379 21.1252 11.0339 21.7319C9.52953 22.3383 7.92632 21.948 7.19733 20.2328L4.64435 14.2107C4.44652 13.7439 4.9435 13.2852 5.41132 13.5028ZM5.76295 11.7365L11.8185 9.43365C13.831 8.66829 16.0294 10.1164 15.9997 12.2205C15.9992 12.248 15.9988 12.2755 15.9981 12.3032C15.9546 14.3522 13.8173 15.7293 11.849 15.0045L5.76869 12.7656C5.28366 12.5871 5.28008 11.9202 5.76295 11.7365ZM5.42395 10.9389L11.3767 8.39424C13.3548 7.54855 13.8568 5.0104 12.3076 3.54387C12.2873 3.52459 12.2669 3.50543 12.2464 3.48639C10.7275 2.06803 8.21661 2.56742 7.35189 4.43561L4.68064 10.2075C4.46751 10.6678 4.9492 11.1418 5.42395 10.9389ZM3.89204 9.93335L6.05629 3.96321C6.32461 3.22296 6.27491 2.46806 5.99751 1.81671C5.29505 0.167968 3.39268 -0.364236 1.88884 0.243365C0.385249 0.851201 -0.464391 2.23163 0.266022 3.94623L2.83573 9.96172C3.035 10.4279 3.71954 10.4095 3.89204 9.93335Z" fill="#FFC233" />
//       </svg>
//     )
//   },
//   {
//     value: "paddle", label: "Paddle", img: (
//       <svg width="30" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//         <rect width="24" height="24" fill="#FFD400" />
//         <path d="M6 11.4101V12.5816C7.07699 12.5799 8.13038 12.8967 9.02744 13.4921C9.92449 14.0876 10.6251 14.935 11.0409 15.9276C11.3143 16.5843 11.4552 17.2894 11.4538 18H12.5462C12.5462 16.565 13.1207 15.1894 14.1441 14.1752C15.1696 13.159 16.5556 12.5892 18 12.5899V11.4184C16.9234 11.4185 15.8707 11.101 14.9739 10.5058C14.0772 9.91053 13.3763 9.06404 12.9591 8.07244C12.6855 7.41576 12.5451 6.71131 12.5462 6H11.4538C11.4538 7.43498 10.8793 8.81062 9.85591 9.82477C8.83059 10.8412 7.44442 11.4111 6 11.4101Z" fill="#161616" />
//       </svg>
//     )
//   },
//   {
//     value: "dodo", label: "Dodo Payments", img: (
//       <svg width="30" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//         <rect width="30" height="32" fill="#C6FE1E" />
//         <mask id="mask0_0_1" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="4" y="5" width="16" height="14">
//           <path d="M20 5H4V18.3333H20V5Z" fill="white" />
//         </mask>
//         <g mask="url(#mask0_0_1)">
//           <path d="M10.1935 8.07666H10.1864C9.74552 7.95008 9.27903 8.20324 9.1297 8.62137C8.96472 9.07079 9.22641 9.58564 9.68863 9.72786C10.8207 10.0493 11.3071 8.42653 10.1935 8.07666Z" fill="#0D0D0D" />
//           <path d="M19.8417 10.3701C18.3839 7.17723 13.7332 8.49847 13.3037 7.6622C12.0451 5.68674 9.69555 4.5774 7.15547 5.14914C6.76435 4.99269 5.41751 4.95003 4.54711 5.49758L5.07191 5.7294C5.11173 5.74647 5.10035 5.7422 5.15867 5.76354C5.39618 5.85314 5.35493 5.82754 5.18427 5.9214C4.79315 6.15038 4.30533 6.41634 4.00098 6.81598C4.01378 6.83447 4.67084 6.99234 4.67084 6.99234C4.68222 6.99518 4.80453 7.00798 4.77751 7.06202C2.62853 10.4554 6.25235 15.5769 8.01164 18.3331H13.1046C12.3181 16.9251 11.4193 15.0037 11.7265 13.6995C11.782 13.4634 11.8531 13.1634 12.1432 13.1235C12.8444 13.0112 13.783 13.0211 14.4515 12.9458H14.4614C14.6036 12.9386 18.0852 12.4963 18.9187 14.6666C18.9898 14.8658 19.1533 14.7363 19.2188 14.6055C19.8403 13.3696 20.2413 11.424 19.8445 10.3715L19.8417 10.3701ZM14.2211 9.32194C13.9764 9.75856 13.81 10.326 13.7674 10.821C13.7446 11.1353 13.7773 11.4453 13.8086 11.7596C13.8257 11.9331 13.8271 12.1522 13.6877 12.2659C13.5668 12.3683 13.3663 12.3783 13.1644 12.3925C12.1731 12.3882 9.75529 12.3925 8.82373 11.7582L8.81804 11.7539C7.46267 10.9276 6.73733 9.06167 7.54231 7.61243C7.80258 7.12034 8.28187 6.80034 8.828 6.67945C9.53058 6.51874 10.3043 6.6382 10.9315 6.96674C11.1875 7.09616 11.4932 7.26683 11.7265 7.46309C12.1887 7.867 12.5841 8.28656 13.19 8.41598C13.4687 8.49562 13.7588 8.48425 14.0376 8.54114C14.5596 8.66629 14.4287 8.96354 14.2196 9.31909L14.2211 9.32194Z" fill="#0D0D0D" />
//         </g>
//       </svg>
//     )
//   },
// ];

// const CONNECT_URLS: Record<Provider, string | null> = {
//   stripe:
//     "https://dashboard.stripe.com/apikeys/create" +
//     "?name=Convrs" +
//     "&permissions[]=rak_charge_read&permissions[]=rak_subscription_read" +
//     "&permissions[]=rak_customer_read&permissions[]=rak_payment_intent_read" +
//     "&permissions[]=rak_checkout_session_read&permissions[]=rak_invoice_read" +
//     "&permissions[]=rak_webhook_write&permissions[]=rak_product_read",
//   polar: "https://polar.sh/dashboard",
//   lemonsqueezy: "https://app.lemonsqueezy.com/settings/api",
//   paddle: "https://vendors.paddle.com/authentication",
//   dodo: null,
// };

// export default function RevenueSettingsPage() {
//   const { id: workspaceId } = useWorkspace();
//   const { integrations, loading, mutate } = useIntegrations();
//   const [provider, setProvider] = useState<Provider>("stripe");
//   const [openPopover, setOpenPopover] = useState(false);
//   const [apiKey, setApiKey] = useState("");
//   const [webhookSecret, setWebhookSecret] = useState("");
//   const [connecting, setConnecting] = useState(false);
//   const [disconnecting, setDisconnecting] = useState(false);
//   const [error, setError] = useState("");

//   const active = integrations?.find((i) => i.provider === provider);
//   const selected = PROVIDERS.find((p) => p.value === provider)!;

//   async function handleConnect() {
//     setConnecting(true);
//     setError("");
//     try {
//       const res = await fetch(`/api/integrations/${provider}/connect`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ apiKey, webhookSecret, workspaceId }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data.error || "Failed to connect");
//         setError(data.error || "Failed to connect");
//         return;
//       }
//       toast.success(`${selected.label} connected`);
//       setApiKey("");
//       setWebhookSecret("");
//       await mutate();
//     } catch (e: any) {
//       setError(e.message);
//     } finally {
//       setConnecting(false);
//     }
//   }

//   async function handleDisconnect() {
//     if (!workspaceId) return;
//     setDisconnecting(true);
//     try {
//       const res = await fetch(`/api/integrations/${provider}`, {
//         method: "DELETE",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ workspaceId }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data.error || "Failed to disconnect");
//         return;
//       }
//       toast.success(`${selected.label} disconnected`);
//       await mutate();
//     } catch (e: any) {
//       toast.error(e.message || "Failed to disconnect");
//     } finally {
//       setDisconnecting(false);
//     }
//   }

//   return (
//     <PageWidthWrapper>
//       <SettingsChildrenLayout
//         title="Revenue"
//         description="Connect a payment provider to attribute revenue back to visitors and sessions."
//       >
//         <div className="flex items-center justify-between rounded-2xl bg-neutral-50 p-0">
//           {/* <h2 className="font-display text-sm font-medium text-neutral-600">
//             Provider
//           </h2> */}
//           <Popover
//             openPopover={openPopover}
//             setOpenPopover={setOpenPopover}
//             align="center"
//             popoverContentClassName="rounded-2xl"
//             content={
//               <div className="w-[var(--radix-popover-trigger-width)] p-1">
//                 {PROVIDERS.map((p) => (
//                   <button
//                     key={p.value}
//                     onClick={() => {
//                       setProvider(p.value);
//                       setOpenPopover(false);
//                     }}
//                     className="flex w-full items-center justify-between rounded-none px-2.5 py-2 text-left text-sm hover:bg-neutral-100"
//                   >
//                     <span className="flex font-display text-neutral-600 items-center gap-2">
//                       <div className="flex  items-center justify-center ">
//                         {p.img}
//                       </div>
//                       {p.label}
//                       {/* {p.comingSoon && (
//                         <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
//                           Coming soon
//                         </span>
//                       )} */}
//                     </span>
//                     {provider === p.value && <Check className="h-4 w-4" />}
//                   </button>
//                 ))}
//               </div>
//             }
//           >
//             <button className="flex h-9 w-full font-display items-center gap-1.5 rounded-full border justify-between border-neutral-200 bg-white px-4 text-[14.5px] font-medium text-neutral-700">
//               <div className="flex items-center gap-2">
//                 <div className="flex size-8  items-center justify-center ">
//                   {selected.img}
//                 </div>
//                 {selected.label}
//               </div>
//               <ChevronDown className="h-3.5 w-3.5" />
//             </button>
//           </Popover>
//         </div>

//         {/* for stripe */}
//         {/* <div className="mt-4 rounded-2xl bg-white p-4 sm:p-5">
//           {loading ? (
//             <div className="py-4 text-sm font-medium text-neutral-500">
//               <LoadingSpinner className="mx-auto" />
//             </div>
//           ) : active ? (
//             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//               <h2 className="font-display text-[14.5px] font-medium text-neutral-600">
//                 You have connected {selected.label}
//               </h2>
//               <Button
//                 text="Disconnect"
//                 variant="danger"
//                 className="h-10 w-fit rounded-full px-5 text-[13px] font-display"
//                 onClick={handleDisconnect}
//                 loading={disconnecting}
//               />
//             </div>
//           ) : (
//             <div className="space-y-4">
//               <div>
//                 <h2 className="font-display text-[15px] font-medium leading-tight text-neutral-600">
//                   API key
//                 </h2>
//                 <p className="mt-1 font-display text-sm font-medium text-neutral-500">
//                   Create a restricted API key and paste it below.
//                   {CONNECT_URLS[provider] && (
//                     <>
//                       {" "}
//                       Create from{" "}
//                       <Link
//                         href={CONNECT_URLS[provider]!}
//                         target="_blank"
//                         rel="noopener noreferrer"
//                         className="text-neutral-800 underline underline-offset-2"
//                       >
//                         {selected.label} Dashboard
//                       </Link>
//                       .
//                     </>
//                   )}
//                 </p>
//               </div>

//               <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
//                 <Input
//                   placeholder={
//                     provider === "stripe" ? "rk_live_***************" : "API key"
//                   }
//                   value={apiKey}
//                   onChange={(e) => setApiKey(e.target.value)}
//                   className="h-11 bg-neutral-50"
//                 />
//                 <Button
//                   text="Connect"
//                   className="h-10 w-full rounded-full px-6 sm:w-fit"
//                   onClick={handleConnect}
//                   loading={connecting}
//                   disabled={!apiKey.trim() || connecting}
//                 />
//               </div>

//               {(provider === "lemonsqueezy" || provider === "paddle") && (
//                 <Input
//                   placeholder="Webhook signing secret"
//                   value={webhookSecret}
//                   onChange={(e) => setWebhookSecret(e.target.value)}
//                   className="h-11 bg-neutral-50"
//                 />
//               )}
//             </div>
//           )}
//         </div> */}

//         {/* for polar */}
//         {/* <div className="mt-4 space-y-5 rounded-2xl bg-white p-5">
//           <div>
//             <h2 className="font-display text-[15px] font-medium text-neutral-900">
//               Connect your Polar account
//             </h2>
//             <p className="mt-0.5 font-display text-sm text-neutral-500">
//               Enter your Organization ID and Access Token to connect Polar.
//             </p>
//           </div>

//           <div className="space-y-4">

//             <div>
//               <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
//                 Organization ID
//               </label>

//               <Input
//                 placeholder="your-organization-id"

//                 className="h-11 bg-neutral-50"
//               />

//               <p className="mt-2 font-display text-sm text-neutral-500">
//                 Polar Dashboard{" "}
//                 <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//                 Settings{" "}
//                 <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//                 General{" "}
//                 <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//                 Profile{" "}
//                 <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//                 Copy the <span className="font-medium">Identifier</span>.
//               </p>
//             </div>


//             <div>
//               <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
//                 Access Token
//               </label>

//               <Input
//                 placeholder="polar_oat_********************"
//                 value={apiKey}
//                 onChange={(e) => setApiKey(e.target.value)}
//                 className="h-11 bg-neutral-50"
//               />

//               <p className="mt-2 font-display text-sm text-neutral-500">
//                 Polar Dashboard{" "}
//                 <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//                 Settings{" "}
//                 <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//                 General{" "}
//                 <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//                 Developer{" "}
//                 <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//                 Tokens
//                 <br />
//                 Create a token with{" "}
//                 <span className="font-medium">No Expiration</span> and enable only:
//                 <span className="font-medium">
//                   {" "}
//                   checkout:read, orders:read, organization:read, products:read,
//                   subscriptions:read, webhook:write
//                 </span>
//                 .
//               </p>
//             </div>

//             {(provider === "lemonsqueezy" || provider === "paddle") && (
//               <Input
//                 placeholder="Webhook signing secret"
//                 value={webhookSecret}
//                 onChange={(e) => setWebhookSecret(e.target.value)}
//                 className="h-11 bg-neutral-50"
//               />
//             )}
//           </div>

//           <Button
//             text="Connect"
//             className="h-11 w-full rounded-full"
//             onClick={handleConnect}
//             loading={connecting}
//             disabled={

//               !apiKey.trim() ||
//               connecting
//             }
//           />
//         </div> */}

//         {/* for lemonsqueezy */}
//         {/* <div className="mt-4 space-y-5 rounded-2xl bg-white p-5">
//           <div>
//             <h2 className="font-display text-[15px] font-medium text-neutral-900">
//               Connect your Lemon Squeezy account
//             </h2>
//             <p className="mt-0.5 font-display text-sm text-neutral-500">
//               Find your Store ID and create an API key, then paste them below.
//             </p>
//           </div>

//           <div className="space-y-4">
//             <div>
//               <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
//                 Store ID
//               </label>

//               <Input
//                 placeholder="123456"

//                 className="h-11 bg-neutral-50"
//               />
//             </div>

//             <div>
//               <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
//                 API Key
//               </label>

//               <Input
//                 placeholder="sk_********************************"
//                 value={apiKey}
//                 onChange={(e) => setApiKey(e.target.value)}
//                 className="h-11 bg-neutral-50"
//               />
//             </div>
//           </div>

//           <Button
//             text="Connect"
//             className="h-11 w-full rounded-full"
//             onClick={handleConnect}
//             loading={connecting}

//           />
//         </div> */}

//         {/* for paddle */}
//         <div className="mt-4 space-y-5 rounded-2xl bg-white p-5">
//           <div>
//             <h2 className="font-display text-[15px] font-medium text-neutral-900">
//               Connect your Paddle account
//             </h2>
//             <p className="mt-0.5 font-display text-sm text-neutral-500">
//               Create an API key in your Paddle dashboard, then paste it below.
//             </p>
//           </div>

//           <div>
//             <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
//               API Key
//             </label>

//             <Input
//               placeholder="pdl_live_********************************"
//               value={apiKey}
//               onChange={(e) => setApiKey(e.target.value)}
//               className="h-11 bg-neutral-50"
//             />

//             <p className="mt-2 font-display text-sm font-medium text-neutral-500 leading-6">
//               Paddle Dashboard{" "}
//               <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//               Developer{" "}
//               <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//               Tools{" "}
//               <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
//               Authentication
//               <br />
//               Create an API key with{" "}
//               <span className="font-display font-medium">Never expires</span>{" "}
//               and enable only{" "}
//               <span className="font-display font-medium">
//                 Transactions (Read), Notification Settings (Read), and Notification
//                 Settings (Write)
//               </span>
//               .
//             </p>
//           </div>

//           <Button
//             text="Connect"
//             className="h-11 w-full rounded-full"
//             onClick={handleConnect}
//             loading={connecting}
//             disabled={!apiKey.trim() || connecting}
//           />
//         </div>

//         {/* for dodo payment make also like i have no idea how to make */}
//         {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
//       </SettingsChildrenLayout>
//     </PageWidthWrapper>
//   );
// }


// -----------------------------------------------------------------------------------------------------
// ---------------------------------version3------------------------------------------------------------.
// -----------------------------------------------------------------------------------------------------

"use client";
import useWorkspace from "@/lib/swr/use-workspace";
import useIntegrations from "@/lib/swr/use-integration";
import { PageWidthWrapper } from "@/ui/layout/page-width-wrapper";
import SettingsChildrenLayout from "@/ui/workspaces/SettingsChildrentLayout";
import { Popover, Button, Input, LoadingSpinner } from "@repo/ui";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Provider = "stripe" | "polar" | "lemonsqueezy" | "paddle" | "dodo";

const PROVIDERS: { value: Provider; label: string; img: React.ReactNode }[] = [
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
  {
    value: "dodo", label: "Dodo Payments", img: (
      <svg width="30" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="30" height="32" fill="#C6FE1E" />
        <mask id="mask0_0_1" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="4" y="5" width="16" height="14">
          <path d="M20 5H4V18.3333H20V5Z" fill="white" />
        </mask>
        <g mask="url(#mask0_0_1)">
          <path d="M10.1935 8.07666H10.1864C9.74552 7.95008 9.27903 8.20324 9.1297 8.62137C8.96472 9.07079 9.22641 9.58564 9.68863 9.72786C10.8207 10.0493 11.3071 8.42653 10.1935 8.07666Z" fill="#0D0D0D" />
          <path d="M19.8417 10.3701C18.3839 7.17723 13.7332 8.49847 13.3037 7.6622C12.0451 5.68674 9.69555 4.5774 7.15547 5.14914C6.76435 4.99269 5.41751 4.95003 4.54711 5.49758L5.07191 5.7294C5.11173 5.74647 5.10035 5.7422 5.15867 5.76354C5.39618 5.85314 5.35493 5.82754 5.18427 5.9214C4.79315 6.15038 4.30533 6.41634 4.00098 6.81598C4.01378 6.83447 4.67084 6.99234 4.67084 6.99234C4.68222 6.99518 4.80453 7.00798 4.77751 7.06202C2.62853 10.4554 6.25235 15.5769 8.01164 18.3331H13.1046C12.3181 16.9251 11.4193 15.0037 11.7265 13.6995C11.782 13.4634 11.8531 13.1634 12.1432 13.1235C12.8444 13.0112 13.783 13.0211 14.4515 12.9458H14.4614C14.6036 12.9386 18.0852 12.4963 18.9187 14.6666C18.9898 14.8658 19.1533 14.7363 19.2188 14.6055C19.8403 13.3696 20.2413 11.424 19.8445 10.3715L19.8417 10.3701ZM14.2211 9.32194C13.9764 9.75856 13.81 10.326 13.7674 10.821C13.7446 11.1353 13.7773 11.4453 13.8086 11.7596C13.8257 11.9331 13.8271 12.1522 13.6877 12.2659C13.5668 12.3683 13.3663 12.3783 13.1644 12.3925C12.1731 12.3882 9.75529 12.3925 8.82373 11.7582L8.81804 11.7539C7.46267 10.9276 6.73733 9.06167 7.54231 7.61243C7.80258 7.12034 8.28187 6.80034 8.828 6.67945C9.53058 6.51874 10.3043 6.6382 10.9315 6.96674C11.1875 7.09616 11.4932 7.26683 11.7265 7.46309C12.1887 7.867 12.5841 8.28656 13.19 8.41598C13.4687 8.49562 13.7588 8.48425 14.0376 8.54114C14.5596 8.66629 14.4287 8.96354 14.2196 9.31909L14.2211 9.32194Z" fill="#0D0D0D" />
        </g>
      </svg>
    )
  },
];

const CONNECT_URLS: Record<Provider, string> = {
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
type FormState = {
  apiKey: string;
  webhookSecret: string;
  organizationId: string; // polar
  storeId: string;        // lemonsqueezy
};

const EMPTY_FORM: FormState = {
  apiKey: "",
  webhookSecret: "",
  organizationId: "",
  storeId: "",
};

export default function RevenueSettingsPage() {
  const { id: workspaceId } = useWorkspace();
  const { integrations, loading, mutate } = useIntegrations();
  const [provider, setProvider] = useState<Provider>("stripe");
  const [openPopover, setOpenPopover] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");

  // Clear the form when switching providers so a leftover Stripe key doesn't
  // accidentally get sent as a Polar access token, etc.
  useEffect(() => {
    setForm(EMPTY_FORM);
    setError("");
  }, [provider]);

  const active = integrations?.find((i) => i.provider === provider);
  const selected = PROVIDERS.find((p) => p.value === provider)!;

  function buildConnectPayload(): Record<string, string> {
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

  function isFormValid(): boolean {
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

  async function handleConnect() {
    setConnecting(true);
    setError("");
    try {
      const res = await fetch(`/api/integrations/${provider}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildConnectPayload(), workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to connect");
        setError(data.error || "Failed to connect");
        return;
      }
      toast.success(`${selected.label} connected`);
      setForm(EMPTY_FORM);
      await mutate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!workspaceId) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/integrations/${provider}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to disconnect");
        return;
      }
      toast.success(`${selected.label} disconnected`);
      await mutate();
    } catch (e: any) {
      toast.error(e.message || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <PageWidthWrapper>
      <SettingsChildrenLayout
        title="Revenue"
        description="Connect a payment provider to attribute revenue back to visitors and sessions."
      >
        <div className="flex items-center justify-between rounded-2xl bg-neutral-50 p-0">
          <Popover
            openPopover={openPopover}
            setOpenPopover={setOpenPopover}
            align="center"
            popoverContentClassName="rounded-2xl"
            content={
              <div className="w-[var(--radix-popover-trigger-width)] p-1">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setProvider(p.value);
                      setOpenPopover(false);
                    }}
                    className="flex w-full items-center justify-between rounded-none px-2.5 py-2 text-left text-sm hover:bg-neutral-100"
                  >
                    <span className="flex font-display text-neutral-600 items-center gap-2">
                      <div className="flex items-center justify-center">{p.img}</div>
                      {p.label}
                    </span>
                    {provider === p.value && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            }
          >
            <button className="flex h-9 w-full font-display items-center gap-1.5 rounded-full border justify-between border-neutral-200 bg-white px-4 text-[14.5px] font-medium text-neutral-700">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center">{selected.img}</div>
                {selected.label}
              </div>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </Popover>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-5">
          {loading ? (
            <div className="py-4 text-sm font-medium text-neutral-500">
              <LoadingSpinner className="mx-auto" />
            </div>
          ) : active ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-[14.5px] font-medium text-neutral-600">
                You have connected {selected.label}
              </h2>
              <Button
                text="Disconnect"
                variant="danger"
                className="h-10 w-fit rounded-full px-5 text-[13px] font-display"
                onClick={handleDisconnect}
                loading={disconnecting}
              />
            </div>
          ) : provider === "stripe" ? (
            <div className=" space-y-5 rounded-2xl bg-white ">
              <div>
                <h2 className="font-display text-[15px] font-medium text-neutral-900">
                  Connect your Stripe account
                </h2>
                <p className="mt-1 font-display text-sm text-neutral-500">
                  Create a restricted API key in your <Link href={CONNECT_URLS.stripe} target="_blank" rel="noopener noreferrer" className="text-neutral-800 underline underline-offset-2" > Stripe Dashboard </Link>, then paste it below.
                </p>
              </div>

              <div>
                <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
                  Restricted API Key
                </label>

                <Input
                  placeholder="rk_live_********************************"
                  value={form.apiKey}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, apiKey: e.target.value }))
                  }
                  className="h-11 bg-neutral-50"
                />

              </div>

              <Button
                text="Connect"
                className="h-11 w-full rounded-full"
                onClick={handleConnect}
                loading={connecting}
                disabled={!isFormValid() || connecting}
              />
            </div>
          ) : provider === "polar" ? (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-[15px] font-medium text-neutral-900">
                  Connect your Polar account
                </h2>
                <p className="mt-0.5 font-display text-sm text-neutral-500">
                  Enter your Organization ID and Access Token to connect Polar.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
                    Organization ID
                  </label>
                  <Input
                    placeholder="your-organization-id"
                    value={form.organizationId}
                    onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
                    className="h-11 bg-neutral-50"
                  />
                  <p className="mt-2 font-display text-sm text-neutral-500">
                    Polar Dashboard <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    Settings <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    General <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    Profile <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    Copy the <span className="font-medium">Identifier</span>.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
                    Access Token
                  </label>
                  <Input
                    placeholder="polar_oat_********************"
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    className="h-11 bg-neutral-50"
                  />
                  <p className="mt-2 font-display text-sm text-neutral-500">
                    Polar Dashboard <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    Settings <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    General <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    Developer <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    Tokens
                    <br />
                    Create a token with <span className="font-medium">No Expiration</span> and enable only:
                    <span className="font-medium"> checkout:read, orders:read, organization:read, products:read, subscriptions:read, webhook:write</span>.
                  </p>
                </div>
              </div>

              <Button
                text="Connect"
                className="h-11 w-full rounded-full"
                onClick={handleConnect}
                loading={connecting}
                disabled={!isFormValid() || connecting}
              />
            </div>
          ) : provider === "lemonsqueezy" ? (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-[15px] font-medium text-neutral-900">
                  Connect your Lemon Squeezy account
                </h2>
                <p className="mt-0.5 font-display text-sm text-neutral-500">
                  Find your Store ID and create an API key, then paste them below.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
                    Store ID
                  </label>
                  <Input
                    placeholder="123456"
                    value={form.storeId}
                    onChange={(e) => setForm((f) => ({ ...f, storeId: e.target.value }))}
                    className="h-11 bg-neutral-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
                    API Key
                  </label>
                  <Input
                    placeholder="sk_********************************"
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    className="h-11 bg-neutral-50"
                  />
                  <p className="mt-2 font-display text-sm text-neutral-500">
                    Create from{" "}
                    <Link
                      href={CONNECT_URLS.lemonsqueezy}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-800 underline underline-offset-2"
                    >
                      LemonSqueezy API settings
                    </Link>.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
                    Webhook signing secret
                  </label>
                  <Input
                    placeholder="Signing secret from Settings → Webhooks"
                    value={form.webhookSecret}
                    onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
                    className="h-11 bg-neutral-50"
                  />
                  <p className="mt-2 font-display text-sm text-neutral-500">
                    Create a webhook in LemonSqueezy pointing to{" "}
                    <code className="text-neutral-700">
                      {`{your-app-url}/api/lemonsqueezy/webhook/${workspaceId ?? "{workspaceId}"}`}
                    </code>{" "}
                    subscribed to <span className="font-medium">order_created</span>, then paste its signing secret here.
                  </p>
                </div>
              </div>

              <Button
                text="Connect"
                className="h-11 w-full rounded-full"
                onClick={handleConnect}
                loading={connecting}
                disabled={!isFormValid() || connecting}
              />
            </div>
          ) : provider === "paddle" ? (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-[15px] font-medium text-neutral-900">
                  Connect your Paddle account
                </h2>
                <p className="mt-0.5 font-display text-sm text-neutral-500">
                  Create an API key in your Paddle dashboard, then paste it below.
                </p>
              </div>

              <div>
                <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
                  API Key
                </label>
                <Input
                  placeholder="pdl_live_********************************"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  className="h-11 bg-neutral-50"
                />
                <p className="mt-2 font-display text-sm font-medium text-neutral-500 leading-6">
                  Paddle Dashboard <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                  Developer <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                  Tools <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                  Authentication
                  <br />
                  Create an API key with <span className="font-display font-medium">Never expires</span> and enable only{" "}
                  <span className="font-display font-medium">Transactions (Read), Notification Settings (Read), and Notification Settings (Write)</span>.
                </p>
              </div>

              <Button
                text="Connect"
                className="h-11 w-full rounded-full"
                onClick={handleConnect}
                loading={connecting}
                disabled={!isFormValid() || connecting}
              />
            </div>
          ) : provider === "dodo" ? (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-[15px] font-medium text-neutral-900">
                  Connect your Dodo Payments account
                </h2>
                <p className="mt-0.5 font-display text-sm text-neutral-500">
                  Dodo doesn't yet list Convrs in its integration marketplace, so
                  set up a custom webhook instead — it takes about a minute.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl bg-neutral-50 p-4 font-display text-sm text-neutral-600 leading-6">
                  <p className="font-medium text-neutral-700">1. Create a webhook endpoint</p>
                  <p className="mt-1 text-neutral-500">
                    Dodo Dashboard <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    Developer <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    Webhooks <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    Add endpoint <ArrowRight className="mx-1 inline h-3.5 w-3.5" />
                    choose <span className="font-medium">Custom</span> (not a marketplace integration).
                  </p>
                  <p className="mt-2 text-neutral-500">
                    Set the URL to:
                  </p>
                  <code className="mt-1 block break-all rounded-lg bg-white px-3 py-2 text-[13px] text-neutral-700 border border-neutral-200">
                    {`{your-app-url}/api/dodo/webhook/${workspaceId ?? "{workspaceId}"}`}
                  </code>
                  <p className="mt-2 text-neutral-500">
                    Subscribe it to the <span className="font-medium">payment.succeeded</span> event, then copy the signing secret Dodo generates.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
                    Webhook signing secret
                  </label>
                  <Input
                    placeholder="whsec_********************************"
                    value={form.webhookSecret}
                    onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
                    className="h-11 bg-neutral-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-display text-sm font-medium text-neutral-700">
                    API Key <span className="font-normal text-neutral-400">(optional)</span>
                  </label>
                  <Input
                    placeholder="Only needed if you want us to back-fill past payments"
                    value={form.apiKey}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    className="h-11 bg-neutral-50"
                  />
                  <p className="mt-2 font-display text-sm text-neutral-500">
                    From{" "}
                    <Link
                      href={CONNECT_URLS.dodo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-800 underline underline-offset-2"
                    >
                      Dodo Payments settings
                    </Link>
                    . Attribution works from the webhook alone — this key only
                    enables optional historical backfill.
                  </p>
                </div>
              </div>

              <Button
                text="Connect"
                className="h-11 w-full rounded-full"
                onClick={handleConnect}
                loading={connecting}
                disabled={!isFormValid() || connecting}
              />
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      </SettingsChildrenLayout>
    </PageWidthWrapper>
  );
}