-- AddForeignKey
ALTER TABLE "SocialSyncJob" ADD CONSTRAINT "SocialSyncJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
