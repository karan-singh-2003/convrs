"use client";

import { cn } from "@repo/utils";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ReactNode, Dispatch, SetStateAction, MouseEvent } from "react";

type Item = {
  icon?: ReactNode;
  title: string;
  href?: string;
  onClick?: () => void;
  value: number;
};

export function BarList({
  data,
  maxValue,
  barBackground,
  hoverBackground,
  setShowModal,
  limit,
}: {
  data: Item[];
  maxValue: number;
  barBackground?: string;
  hoverBackground?: string;
  setShowModal?: Dispatch<SetStateAction<boolean>>;
  limit?: number;
}) {
  const list = limit ? data.slice(0, limit) : data;

  return (
    <NumberFlowGroup>
      <div className="flex flex-col">
        {list.map((item, i) => (
          <LineItem
            key={i}
            {...item}
            maxValue={maxValue}
            barBackground={barBackground}
            hoverBackground={hoverBackground}
            setShowModal={setShowModal}
          />
        ))}
      </div>
    </NumberFlowGroup>
  );
}

function LineItem({
  icon,
  title,
  href,
  onClick,
  value,
  maxValue,
  barBackground,
  hoverBackground,
  setShowModal,
}: Item & {
  maxValue: number;
  barBackground?: string;
  hoverBackground?: string;
  setShowModal?: Dispatch<SetStateAction<boolean>>;
}) {
  const percentage = maxValue ? (value / maxValue) * 100 : 0;

  const handleClick = (e: MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
      setShowModal?.(false);
    } else if (href) {
      setShowModal?.(false);
    }
  };

  const As = href ? Link : "button";

  return (
    // @ts-ignore
    <As
      {...(href && { href })}
      onClick={handleClick}
      className={cn(
        "group relative block w-full px-5 my-1 py-2 rounded-full transition-all text-left",
        !href && !onClick && "cursor-default",
        (href || onClick) && "cursor-pointer hover:" + hoverBackground,
        barBackground
      )}
    >
      <div className="relative flex items-center justify-between">
        {/* Left content */}
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <span className="truncate font-default text-sm font-medium text-neutral-600">
            {title}
          </span>
        </div>

        {/* Right content */}
        <div className="flex items-center gap-2">
          <NumberFlow
            value={value}
            className="text-sm font-default font-medium text-neutral-700"
            format={{
              notation: value > 999999 ? "compact" : "standard",
            }}
          />
        </div>
      </div>
    </As>
  );
}
