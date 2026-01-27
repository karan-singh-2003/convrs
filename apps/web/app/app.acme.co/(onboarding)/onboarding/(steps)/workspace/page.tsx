import { Suspense } from "react";
import { Form } from "./form";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <div className="flex items-center justify-center h-screen mx-auto">
        <Form />
      </div>
    </Suspense>
  );
}
