import { Popover, TabSelect, useMediaQuery, Modal } from "@repo/ui";
import { Button } from "@repo/ui";
import { useState } from "react";
import { cn } from "@repo/utils";
import { ChevronDown } from "lucide-react";

export function AnalyticsCard({
  tabs,
  selectedTabId,
  onSelectTab,
  children,
}: {
  tabs: { id: string; label: string }[];
  selectedTabId: string;
  onSelectTab?: (id: string) => void;
  children: (props: {
    setShowModal: (show: boolean) => void;
  }) => React.ReactNode;
}) {
  const { isMobile } = useMediaQuery();
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? tabs[0];
  return (
    <>
      <Modal showModal={showModal} setShowModal={setShowModal} className="max-w-lg ">
        <div className="border-b border-neutral-200 p-2 ">
          <h1 className="font-display font-medium text-base px-3">{selectedTab.label}</h1>
        </div>
        {children({ setShowModal })}
      </Modal>
      <div className="border border-neutral-200 rounded-lg h-[400px] bg-white sm:rounded-xl overflow-hidden group ">
        <div className=" border-b border-neutral-200 ">
          {isMobile ? (
            <Popover
              openPopover={isOpen}
              setOpenPopover={setIsOpen}
              content={
                <div className="grid w-full gap-px p-2 sm:w-48">
                  {tabs.map(({ id, label }) => (
                    <Button
                      key={id}
                      text={label}
                      variant="outline"
                      onClick={() => {
                        onSelectTab?.(id);
                        setIsOpen(false);
                      }}
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
                className="my-2 h-8 w-fit whitespace-nowrap px-4"
                variant="outline"
                text={selectedTab.label}
                right={
                  <ChevronDown
                    className="size-4 shrink-0 text-neutral-400"
                    aria-hidden="true"
                  />
                }
              />
            </Popover>
          ) : (
            <TabSelect
              selected={selectedTabId}
              options={tabs}
              onSelect={onSelectTab}
            />
          )}
        </div>
        <div>
            {children({ setShowModal })}
        </div>
      </div>
    </>
  );
}
