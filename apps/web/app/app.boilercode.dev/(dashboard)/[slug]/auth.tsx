'use client';
import useWorkspace from "@/lib/swr/use-workspace";
import { useParams } from "next/navigation";

export default function WorkspaceAuth({children}: {children: React.ReactNode}) {
  const { slug } = useParams();
  const { loading, error } = useWorkspace();
  console.log("error");
  if (loading) {
    return <div></div>;
  }

  if (error) {
    return <div>Error loading workspace.</div>;
  }

  return children;
}
