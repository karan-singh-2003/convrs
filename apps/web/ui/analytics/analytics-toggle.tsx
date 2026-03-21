import { Filter, Popover } from "@repo/ui";
import { useState } from "react";
import { X } from "lucide-react";
export function AnalyticsToggle() {
  const filters = [
    {
      id: "eventType",
      label: "Event Type",
      options: [
        { value: "click", label: "Click" },
        { value: "view", label: "View" },
        { value: "purchase", label: "Purchase" },
      ],
    },
    {
      id: "userSegment",
      label: "User Segment",
      options: [
        { value: "new", label: "New Users" },
        { value: "returning", label: "Returning Users" },
        { value: "vip", label: "VIP Users" },
      ],
    },
  ];
  const [isOpen, setIsOpen] = useState(false);

  const [period, setPeriod] = useState("Last 24 Hours");

  const periods = [
    { value: "last_24_hours", label: "Last 24 Hours" },
    { value: "last_7_days", label: "Last 7 Days" },
    { value: "last_30_days", label: "Last 30 Days" },
    { value: "last_90_days", label: "Last 90 Days" },
    { value: "last_365_days", label: "Last 1 year" },
    { value: "week_to_date", label: "Week to Date" },
    { value: "month_to_date", label: "Month to Date" },
    { value: "year_to_date", label: "Year to Date" },
    { value: "alltime", label: "All Time" },
  ];
  return (
    <>
      <div className="flex justify-between items-center gap-4">
        <div>
          <Popover
            openPopover={isOpen}
            setOpenPopover={setIsOpen}
            content={
              <div className="w-40  bg-white ">
                {periods.map((p) => (
                  <button
                    key={p.value}
                    className="block w-full text-left font-display px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
                    onClick={() => {
                      setPeriod(p.label);
                      setIsOpen(false);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            }
            align="center"
          >
            <button
              type="button"
              className="flex items-center font-display font-medium rounded-full bg-neutral-50  px-4 py-1 gap-2 text-sm text-neutral-500 hover:text-neutral-600"
            >
              <span>{period}</span>
            </button>
          </Popover>
        </div>
        <Filter.Select filters={filters} />
      </div>

      <div className="mt-4 flex items-center gap-2 px-4 py-1.5 w-fit rounded-full bg-neutral-50">
        <p className="text-sm font-default text-neutral-600">
          <span className="font-medium">Country</span> is{" "}
          <span className="font-medium">United States</span>
        </p>

        <button className="rounded-full  hover:text-neutral-600 transition">
          <X size={14} className="text-neutral-500" />
        </button>
      </div>
    </>
  );
}
