-- AlterTable
-- New workspaces now default to requiring an authenticated /api/ai-crawls
-- caller. This ALTER only changes the column's default for FUTURE inserts —
-- it does not touch any existing row's already-stored value (see
-- workspace.prisma's comment on botTrafficRequireAuth for why that's safe).
ALTER TABLE "Workspace" ALTER COLUMN "botTrafficRequireAuth" SET DEFAULT true;
