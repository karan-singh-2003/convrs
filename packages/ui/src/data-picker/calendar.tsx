import { cn } from "@repo/utils";
import { addYears, format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { ElementType, HTMLAttributes, forwardRef } from "react";
import {
  DayPicker,
  useDayPicker,
  useNavigation,
  type DayPickerRangeProps,
  type DayPickerSingleProps,
  type Matcher,
} from "react-day-picker";

interface NavigationButtonProps extends HTMLAttributes<HTMLButtonElement> {
  onClick: () => void;
  icon: ElementType;
  disabled?: boolean;
}

const NavigationButton = forwardRef<HTMLButtonElement, NavigationButtonProps>(
  (
    { onClick, icon: Icon, disabled, ...props }: NavigationButtonProps,
    forwardedRef
  ) => {
    return (
      <button
        ref={forwardedRef}
        type="button"
        disabled={disabled}
        className={cn(
          "flex size-7 shrink-0 select-none items-center justify-center rounded border p-1 outline-none transition",
          "border-neutral-200 text-neutral-600 hover:text-neutral-800",
          "hover:bg-neutral-50 active:bg-neutral-100",
          "disabled:pointer-events-none disabled:text-neutral-400"
        )}
        onClick={onClick}
        {...props}
      >
        <Icon className="h-full w-full shrink-0" />
      </button>
    );
  }
);

NavigationButton.displayName = "NavigationButton";

function Calendar(
  calendarProps: (DayPickerSingleProps | DayPickerRangeProps) & {
    showYearNavigation?: boolean;
    disableNavigation?: boolean;
    [key: string]: any;
  }
) {
  const {
    showYearNavigation = false,
    disableNavigation,
    ...props
  } = calendarProps as any;

  // Extract only valid DayPicker props, excluding PickerProps that conflicts
  const { required, showTimePicker, className, classNames, ...dayPickerProps } =
    props;

  return (
    <DayPicker
      showOutsideDays={true}
      classNames={{
        months: "flex space-y-0",
        month: "space-y-4 p-3 w-full",
        nav: "gap-1 flex items-center rounded-full w-full h-full justify-between p-4",
        table: "w-full border-separate border-spacing-y-1",
        head_cell: "w-9 font-medium text-xs text-center text-neutral-400 pb-2",
        row: "w-full",
        cell: "relative p-0 text-center focus-within:relative text-neutral-900",
        day: cn(
          "relative size-10 rounded-md text-sm text-neutral-900",
          "hover:bg-neutral-100 active:bg-neutral-200 outline outline-offset-2 outline-0 focus-visible:outline-2 outline-blue-500"
        ),
        day_today: "font-semibold",
        day_selected:
          "rounded aria-selected:bg-blue-500 aria-selected:text-white",
        day_disabled:
          "!text-neutral-300 line-through disabled:hover:bg-transparent",
        day_outside: "text-neutral-400",
        day_range_middle:
          "!rounded-none aria-selected:!bg-blue-100 aria-selected:!text-blue-900",
        day_range_start: "rounded-r-none !rounded-l",
        day_range_end: "rounded-l-none !rounded-r",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: (captionProps: any) => {
          const { goToMonth, nextMonth, previousMonth } = useNavigation();
          const dayPicker = useDayPicker();
          const numberOfMonths = (dayPicker as any).numberOfMonths || 1;
          const fromDate = (dayPicker as any).fromDate;
          const toDate = (dayPicker as any).toDate;

          const isFirst = captionProps.displayIndex === 0;
          const isLast = captionProps.displayIndex === numberOfMonths - 1;

          const hideNextButton = numberOfMonths > 1 && (isFirst || !isLast);
          const hidePreviousButton = numberOfMonths > 1 && (isLast || !isFirst);

          const goToPreviousYear = () => {
            const targetMonth = addYears(captionProps.displayMonth, -1);
            if (
              previousMonth &&
              (!fromDate || targetMonth.getTime() >= fromDate.getTime())
            ) {
              goToMonth(targetMonth);
            }
          };

          const goToNextYear = () => {
            const targetMonth = addYears(captionProps.displayMonth, 1);
            if (
              nextMonth &&
              (!toDate || targetMonth.getTime() <= toDate.getTime())
            ) {
              goToMonth(targetMonth);
            }
          };

          return (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {showYearNavigation && !hidePreviousButton && (
                  <NavigationButton
                    disabled={
                      disableNavigation ||
                      !previousMonth ||
                      (fromDate &&
                        addYears(captionProps.displayMonth, -1).getTime() <
                          fromDate.getTime())
                    }
                    aria-label="Go to previous year"
                    onClick={goToPreviousYear}
                    icon={ChevronsLeft}
                  />
                )}
                {!hidePreviousButton && (
                  <NavigationButton
                    disabled={disableNavigation || !previousMonth}
                    aria-label="Go to previous month"
                    onClick={() => previousMonth && goToMonth(previousMonth)}
                    icon={ChevronLeft}
                  />
                )}
              </div>

              <div
                role="presentation"
                aria-live="polite"
                className="text-sm font-medium capitalize tabular-nums text-neutral-900"
              >
                {format(captionProps.displayMonth, "LLLL yyy")}
              </div>

              <div className="flex items-center gap-1">
                {!hideNextButton && (
                  <NavigationButton
                    disabled={disableNavigation || !nextMonth}
                    aria-label="Go to next month"
                    onClick={() => nextMonth && goToMonth(nextMonth)}
                    icon={ChevronRight}
                  />
                )}
                {showYearNavigation && !hideNextButton && (
                  <NavigationButton
                    disabled={
                      disableNavigation ||
                      !nextMonth ||
                      (toDate &&
                        addYears(captionProps.displayMonth, 1).getTime() >
                          toDate.getTime())
                    }
                    aria-label="Go to next year"
                    onClick={goToNextYear}
                    icon={ChevronsRight}
                  />
                )}
              </div>
            </div>
          );
        },
      }}
      {...(dayPickerProps as any)}
    />
  );
}

export { Calendar, type Matcher };
