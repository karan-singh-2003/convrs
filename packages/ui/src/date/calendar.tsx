import { cn } from "@repo/utils";
import { addYears, format, isSameMonth } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { ElementType, HTMLAttributes, forwardRef, useRef } from "react";
import {
  DayPicker,
  useDayPicker,
  useDayRender,
  useNavigation,
  type DayPickerRangeProps,
  type DayPickerSingleProps,
  type DayProps,
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
    forwardedRef,
  ) => {
    return (
      <button
        ref={forwardedRef}
        type="button"
        disabled={disabled}
        className={cn(
          "flex size-6 shrink-0 select-none items-center justify-center rounded  p-1 outline-none transition",
          "text-content-default hover:text-content-strong",
          "hover:bg-bg-subtle active:bg-bg-muted",
          "disabled:pointer-events-none disabled:text-content-disabled",
        )}
        onClick={onClick}
        {...props}
      >
        <Icon className="h-full w-full shrink-0" />
      </button>
    );
  },
);

NavigationButton.displayName = "NavigationButton";

type OmitKeys<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};

type KeysToOmit = "showWeekNumber" | "captionLayout" | "mode";

type SingleProps = OmitKeys<DayPickerSingleProps, KeysToOmit>;
type RangeProps = OmitKeys<DayPickerRangeProps, KeysToOmit>;

type CalendarProps =
  | ({
    mode: "single";
  } & SingleProps)
  | ({
    mode?: undefined;
  } & SingleProps)
  | ({
    mode: "range";
  } & RangeProps);

function Calendar({
  mode = "single",
  weekStartsOn = 0,
  numberOfMonths = 1,
  showYearNavigation = false,
  disableNavigation,
  locale,
  className,
  classNames,
  ...props
}: CalendarProps & { showYearNavigation?: boolean }) {
  return (
    <DayPicker
      formatters={{
        formatWeekdayName: (date) => format(date, "EEE"),
      }}
      mode={mode}
      weekStartsOn={weekStartsOn}
      numberOfMonths={numberOfMonths}
      locale={locale}
      showOutsideDays={numberOfMonths === 1 ? true : false}
      className={className}
      classNames={{
        months: "flex space-y-0",
        month: "space-y-2 p-2 w-full",
        nav: "gap-1 flex items-center rounded-full w-full h-full justify-between p-4",
        table: "w-full border-separate border-spacing-y-0.5",
        head_cell: "w-9 pb-4 text-center text-sm font-normal text-content-subtle",
        row: "w-full",
        cell: "relative p-0 text-center text-content-default focus-within:relative",
        day: cn(
          "relative size-9 rounded-md font-poppins text-sm text-content-default",
          "hover:bg-bg-subtle active:bg-bg-muted outline outline-0 outline-offset-2 focus-visible:outline-2 outline-content-default",
        ),
        day_today: "font-normal",
        // day_selected:
        //   "rounded aria-selected:bg-bg-inverted aria-selected:text-bg-card aria-selected:font-normal",
        day_disabled:
          "!text-content-disabled line-through disabled:hover:bg-transparent",
        day_outside: "text-content-subtle",
        day_selected:
          "rounded-md aria-selected:bg-bg-inverted aria-selected:text-content-inverted aria-selected:font-medium",

        day_range_start:
          "rounded-r-none !rounded-l-md aria-selected:bg-bg-inverted aria-selected:text-content-inverted",

        day_range_end:
          "rounded-l-none !rounded-r-md aria-selected:bg-bg-inverted aria-selected:text-content-inverted",

        day_range_middle:
          "!rounded-none aria-selected:bg-bg-emphasis aria-selected:text-content-inverted",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
        Caption: ({ ...props }) => {
          const {
            goToMonth,
            nextMonth,
            previousMonth,
            currentMonth,
            displayMonths,
          } = useNavigation();
          const { numberOfMonths, fromDate, toDate } = useDayPicker();

          const displayIndex = displayMonths.findIndex((month) =>
            isSameMonth(props.displayMonth, month),
          );
          const isFirst = displayIndex === 0;
          const isLast = displayIndex === displayMonths.length - 1;

          const hideNextButton = numberOfMonths > 1 && (isFirst || !isLast);
          const hidePreviousButton = numberOfMonths > 1 && (isLast || !isFirst);

          const goToPreviousYear = () => {
            const targetMonth = addYears(currentMonth, -1);
            if (
              previousMonth &&
              (!fromDate || targetMonth.getTime() >= fromDate.getTime())
            ) {
              goToMonth(targetMonth);
            }
          };

          const goToNextYear = () => {
            const targetMonth = addYears(currentMonth, 1);
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
                        addYears(currentMonth, -1).getTime() <
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
                className="text-content-default text-sm font-medium capitalize tabular-nums"
              >
                {format(props.displayMonth, "LLLL yyy", { locale })}
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
                        addYears(currentMonth, 1).getTime() > toDate.getTime())
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
        Day: ({ date, displayMonth }: DayProps) => {
          const buttonRef = useRef<HTMLButtonElement>(null!);
          const { activeModifiers, buttonProps, divProps, isButton, isHidden } =
            useDayRender(date, displayMonth, buttonRef);

          const { selected, today, disabled, range_middle } = activeModifiers;

          if (isHidden) return <></>;

          if (!isButton) {
            return (
              <div
                {...divProps}
                className={cn(
                  "flex items-center justify-center",
                  divProps.className,
                )}
              />
            );
          }

          const { children: buttonChildren, ...buttonPropsRest } = buttonProps;

          return (
            <button ref={buttonRef} {...buttonPropsRest} type="button">
              {buttonChildren}
              {today && (
                <span
                  className={cn(
                    "absolute inset-x-1/2 bottom-1.5 h-0.5 w-4 -translate-x-1/2 rounded-[2px]",
                    {
                      "bg-content-default": !selected,
                      "!bg-bg-card": selected,
                      "!bg-content-subtle": selected && range_middle,
                      "!bg-content-disabled": disabled,
                    }
                  )}
                />
              )}
            </button>
          );
        },
      }}
      {...(props as SingleProps & RangeProps)}
    />
  );
}

export { Calendar, type Matcher };