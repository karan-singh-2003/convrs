import { Suspense } from "react";
import { Form } from "./form";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <Form />
    </Suspense>
  );
}
