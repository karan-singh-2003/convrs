import { LoadingSpinner } from "@repo/ui";

export default function LayoutLoader() {
  return (
    <div className="flex items-center justify-center h-[500px]">
      <LoadingSpinner />
    </div>
  );
}