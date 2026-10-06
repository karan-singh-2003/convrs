-- AlterTable
-- Bot Traffic authentication becomes optional by default: new workspaces
-- accept /api/ai-crawls events identified by the public project token, and a
-- bot token is opt-in hardening ("Reject unauthenticated requests").
-- This ALTER only changes the column default for FUTURE inserts. It does not
-- update any existing row: workspaces keep their stored setting.
ALTER TABLE "Workspace" ALTER COLUMN "botTrafficRequireAuth" SET DEFAULT false;
