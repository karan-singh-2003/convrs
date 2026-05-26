"use client";

import { EventType } from "@/lib/analytics/types";
import {
  AnimatedSizeContainer,
  Button,
  Modal,
  Popover,
  TabSelect,
  ToggleGroup,
  useMediaQuery,
} from "@repo/ui";

import { cn } from "@repo/utils";
import { ChevronsUpDown } from "lucide-react";
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useState,
} from "react";
import { AnalyticsContext } from "./analytics-providers";

export function AnalyticsCard<T extends string>({
  tabs,
  selectedTabId,
  onSelectTab,
  subTabs,
  selectedSubTabId,
  onSelectSubTab,
  expandLimit,
  dataLength,
  children,
  className,
}: {
  tabs: { id: T; label: string; icon?: React.ElementType }[];
  selectedTabId: T;
  onSelectTab?: Dispatch<SetStateAction<T>> | ((tabId: T) => void);
  subTabs?: { id: string; label: string }[];
  selectedSubTabId?: string;
  onSelectSubTab?:
    | Dispatch<SetStateAction<string>>
    | ((subTabId: string) => void);
  expandLimit: number;
  dataLength?: number;
  isFilterActive?: boolean;
  onClearFilter?: () => void;
  children: (props: {
    limit?: number;
    event?: EventType;
    setShowModal: (show: boolean) => void;
  }) => ReactNode;
  className?: string;
}) {
  const { selectedTab: event } = useContext(AnalyticsContext);

  const [showModal, setShowModal] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const selectedTab = tabs.find(({ id }) => id === selectedTabId) || tabs[0];
  const SelectedTabIcon = selectedTab.icon;
  const { isMobile } = useMediaQuery();
  const hasSecondaryTabs = !!(subTabs && selectedSubTabId && onSelectSubTab);
  const effectiveExpandLimit = hasSecondaryTabs
    ? Math.max(1, expandLimit - 1)
    : expandLimit;
  const showViewAll = (dataLength ?? 0) > effectiveExpandLimit;

  return (
    <>
      <Modal
        showModal={showModal}
        setShowModal={setShowModal}
        className="max-w-lg px-0"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-2">
          <h1 className=" text-[15px] text-neutral-700 font-medium md:text-lg font-display md:font-semibold">
            {selectedTab?.label}
          </h1>
        </div>
        {subTabs && selectedSubTabId && onSelectSubTab && (
          <SubTabs
            subTabs={subTabs}
            selectedTab={selectedSubTabId}
            onSelectTab={onSelectSubTab}
          />
        )}
        {children({ setShowModal, event })}
      </Modal>
      <div
        className={cn(
          "group relative z-0 h-[400px] overflow-hidden rounded-lg border border-neutral-200 bg-white sm:h-[450px] sm:rounded-xl",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-3 sm:px-4">
          {/* Main tabs */}
          {isMobile ? (
            <Popover
              openPopover={isOpen}
              setOpenPopover={setIsOpen}
              content={
                <div className="grid w-full gap-px p-2 sm:w-48">
                  {tabs.map(({ id, label, icon: Icon }) => (
                    <Button
                      key={id}
                      text={label}
                      variant="outline"
                      onClick={() => {
                        onSelectTab?.(id);
                        setIsOpen(false);
                      }}
                      icon={Icon && <Icon className="size-4" />}
                      className={cn(
                        "h-9 w-full justify-start px-2 font-medium",
                        selectedTabId === id && "bg-neutral-100"
                      )}
                    />
                  ))}
                </div>
              }
              align="end"
            >
              <Button
                type="button"
                className="my-2 h-6 text-neutral-700 text-sm md:h-8 w-fit whitespace-nowrap px-2"
                variant="outline"
                icon={SelectedTabIcon && <SelectedTabIcon className="size-4" />}
                text={selectedTab.label}
                right={
                  <ChevronsUpDown
                    className="size-4 shrink-0 text-neutral-400"
                    aria-hidden="true"
                  />
                }
              />
            </Popover>
          ) : (
            <TabSelect
              options={tabs}
              selected={selectedTabId}
              onSelect={onSelectTab}
              className="font-display text-sm md:text-[15px]"
            />
          )}

          {/* <div className="flex items-center gap-1 pr-2 text-neutral-500">
            <p className="text-xs uppercase">{event}</p>
          </div> */}
        </div>
        <AnimatedSizeContainer
          height
          transition={{ ease: "easeInOut", duration: 0.2 }}
        >
          {subTabs && selectedSubTabId && onSelectSubTab && (
            <SubTabs
              subTabs={subTabs}
              selectedTab={selectedSubTabId}
              onSelectTab={onSelectSubTab}
            />
          )}
        </AnimatedSizeContainer>
        <div className="py-3 sm:py-4">
          {children({
            limit: effectiveExpandLimit,
            event,
            setShowModal,
          })}
        </div>
        {showViewAll && (
          <div className="absolute bottom-0 left-0 z-10 flex w-full items-end">
            <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-white sm:h-48" />
            <div className="relative flex w-full items-center justify-center gap-2 py-3 px-2 sm:py-4">
              <button
                onClick={() => setShowModal(true)}
                className="h-8 w-full rounded-none font-poppins font-medium border-neutral-200 bg-white px-3 text-[12.5px] text-neutral-600 transition-colors hover:bg-neutral-100 active:border-neutral-300 sm:w-fit sm:text-[13px]"
              >
                View All
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SubTabs({
  subTabs,
  selectedTab,
  onSelectTab,
}: {
  subTabs: { id: string; label: string }[];
  selectedTab: string;
  onSelectTab: (key: string) => void;
}) {
  return (
    <ToggleGroup
      key={JSON.stringify(subTabs)}
      options={subTabs.map(({ id, label }) => ({
        value: id,
        label: label,
      }))}
      selected={selectedTab}
      selectAction={(period) => onSelectTab(period)}
      className="flex w-full font-display flex-wrap rounded-none border-x-0 border-t-0 border-neutral-200 bg-neutral-50 px-3 py-2 sm:flex-nowrap sm:px-5"
      optionClassName="text-[13px] px-2 text-neutral-500 font-medium hover:text-neutral-700 sm:text-[15px] sm:px-2.5"
      indicatorClassName="border-0 bg-transparent rounded-md"
    />
  );
}
