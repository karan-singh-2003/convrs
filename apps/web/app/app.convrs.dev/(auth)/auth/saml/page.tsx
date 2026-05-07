import { Suspense } from "react";
import SAMLIDPForm from "./form";

export default function SAMLPage() {
  return (
    <>
      <Suspense>
        <SAMLIDPForm />
      </Suspense>
    </>
  );
}
