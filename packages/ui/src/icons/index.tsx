"use client";

import { LucideIcon } from "lucide-react";
import { ComponentType, SVGProps } from "react";

export * from "./loading-spinner";
export * from "./google";
export * from "./github";
export * from "./cloud-upload";
export * from "./loading-circle";
export * from "./alert-circle-fill";
export * from "./link-broken";
export * from "./users";
export * from "./input-password";
export * from "./check2";
export * from "./copy";
export * from "./tick";
export * from "./layout-sidebar";
export * from "./checkbox-checked-fill";
export * from "./checkbox-unchecked";
export * from "./plus";
export * from "./circle-check";
export * from "./circle-half-dotted-clock";
export * from "./x-logo";
export * from "./youtube";
export * from "./reddit";
export * from "./product-hunt";
export * from "./continents/index";

export * from "./window";
export * from "./latop";
export * from "./apple-logo";
export * from "./desktop";
export * from "./mobile"
export * from "./unknown"


export type Icon = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
