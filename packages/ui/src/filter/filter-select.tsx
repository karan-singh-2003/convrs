import { ArrowLeft, ListFilter, Search } from "lucide-react";
import { Popover } from "../popover";
import { Filters } from "./types";
import { PropsWithChildren, useState } from "react";
import { cn } from "@repo/utils";

type FilterSelectProps = {
  filters: Filters[];
  className?: string;
};

export function FilterSelect({ filters, className }: FilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover
      openPopover={isOpen}
      setOpenPopover={setIsOpen}
      content={<FilterContent filters={filters} />}
      align="end"
    >
      <button
        type="button"
        className={cn(
          "group flex h-8 cursor-pointer appearance-none items-center gap-x-2 truncate rounded-full border px-1.5 text-sm outline-none transition-all",
          "border-neutral-200 bg-white text-neutral-700 placeholder-neutral-400",
          " data-[state=open]:border-neutral-200 ",
          className
        )}
      >
        <ListFilter className="size-4 shrink-0" />
      </button>
    </Popover>
  );
}

export function FilterContent({ filters }: { filters: Filters[] }) {
  const [activeFilter, setActiveFilter] = useState<Filters | null>(null);

  return (
    <div className="w-full md:w-[19rem] overflow-hidden rounded-md  bg-white ">
      <div className="relative h-[260px] ">
        {/* 🔹 Labels */}
        <Area visible={!activeFilter}>
          <h1 className="font-display text-sm px-3 text-neutral-500 my-1 py-2">
            Filters{" "}
          </h1>
          <div className="px-2 ">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter)}
                className="flex w-full items-center  justify-between  px-2 py-2 text-sm text-neutral-600 "
              >
                <span className="font-display font-medium">
                  {" "}
                  {filter.label}
                </span>
                <span className="text-[13px] text-neutral-500 font-display">
                  {filter.options.length}
                </span>
              </button>
            ))}
          </div>
        </Area>

        {/* 🔹 Options */}
        <Area visible={!!activeFilter}>
          {activeFilter && (
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 ">
                <button
                  onClick={() => setActiveFilter(null)}
                  className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
                >
                  <ArrowLeft size={14} />
                  <span className="font-medium">{activeFilter.label}</span>
                </button>
              </div>

              {/* Search */}
              <div className="px-2 my-1">
                <div className="flex items-center gap-2 rounded-full  bg-neutral-50 px-3 h-[32px] focus-within:ring-1 focus-within:ring-neutral-200">
                  <Search size={18} className="text-neutral-400" />
                  <input
                    placeholder="Search"
                    className="w-full bg-transparent p-0 focus:border-none font-display focus:ring-0 focus:outline-0 border-none text-[15px] outline-none placeholder:text-neutral-400"
                  />
                </div>
              </div>

              {/* Options list */}
              <div className="flex-1 overflow-y-auto px-1 my-2 pb-2">
                <div className="space-y-1">
                  {activeFilter.options.map((option) => (
                    <button
                      key={option.value}
                      className="w-full rounded-none font-display px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Area>
      </div>
    </div>
  );
}

function Area({ visible, children }: PropsWithChildren<{ visible: boolean }>) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col transition-all duration-300",
        visible
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0 pointer-events-none"
      )}
    >
      {children}
    </div>
  );
}
