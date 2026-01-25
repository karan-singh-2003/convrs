"use client";

import { LucideIcon } from "lucide-react";
import { ComponentType, SVGProps } from "react";


export * from "./loading-spinner";
export * from "./google"
export * from "./github"
export * from "./cloud-upload"
export * from "./loading-circle"
export * from "./alert-circle-fill";
export * from "./link-broken"
export * from "./users"
export * from "./input-password"


export type Icon = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;