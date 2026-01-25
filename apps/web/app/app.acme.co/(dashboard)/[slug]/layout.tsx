import WorkspaceAuth from "./auth";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceAuth>{children}</WorkspaceAuth>;
}
