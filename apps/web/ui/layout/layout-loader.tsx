import { LoadingSpinner } from "@repo/ui";

export default function LayoutLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner />
    </div>
  );
}