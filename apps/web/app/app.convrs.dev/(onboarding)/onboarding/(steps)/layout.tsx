import { PropsWithChildren } from "react";
import SignedInHint from "../../signed-in-hint";

export default async function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <SignedInHint></SignedInHint>
      <div className="p-5">{children}</div>
    </>
  );
}
