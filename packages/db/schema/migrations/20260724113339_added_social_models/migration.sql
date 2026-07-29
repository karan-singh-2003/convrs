-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('x', 'reddit');

-- CreateEnum
CREATE TYPE "SocialIntegrationStatus" AS ENUM ('active', 'expired', 'revoked', 'error');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('active', 'deleted', 'suspended');

-- CreateEnum
CREATE TYPE "DiscoveredVia" AS ENUM ('link_discovery', 'keyword_search', 'both');

-- CreateEnum
CREATE TYPE "SocialKeywordMatchType" AS ENUM ('exact_phrase', 'handle', 'hashtag', 'broad');

-- CreateEnum
CREATE TYPE "AttributionConfidence" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "AttributionMatchMethod" AS ENUM ('exact_url', 'fuzzy_url', 'link_in_bio');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('link_discovery', 'mention_search', 'metadata_refresh', 'historical_backfill', 'attribution_reconciliation');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'rate_limited');

-- CreateTable
CREATE TABLE "SocialIntegration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SocialIntegrationStatus" NOT NULL DEFAULT 'active',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "followerCount" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricsUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAttributionHandle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAttributionHandle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "extractedUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quotedPostId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER,
    "metricsUpdatedAt" TIMESTAMP(3),
    "status" "SocialPostStatus" NOT NULL DEFAULT 'active',
    "discoveredVia" "DiscoveredVia" NOT NULL DEFAULT 'link_discovery',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialKeyword" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "matchType" "SocialKeywordMatchType" NOT NULL DEFAULT 'broad',
    "platforms" "SocialPlatform"[] DEFAULT ARRAY['x', 'reddit']::"SocialPlatform"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMention" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "socialPostId" TEXT NOT NULL,
    "matchedKeywordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spamScore" DOUBLE PRECISION,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "firstMatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "socialKeywordId" TEXT,

    CONSTRAINT "SocialMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkAttribution" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "socialPostId" TEXT,
    "confidence" "AttributionConfidence" NOT NULL DEFAULT 'medium',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "matchMethod" "AttributionMatchMethod" NOT NULL DEFAULT 'exact_url',
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialSyncJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "jobType" "SyncJobType" NOT NULL,
    "platform" "SocialPlatform",
    "status" "SyncJobStatus" NOT NULL DEFAULT 'pending',
    "cursor" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceDomain" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "isCustomDomain" BOOLEAN NOT NULL DEFAULT false,
    "usedForSocialDiscovery" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountBlocklist" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "blockedAccountExternalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBlocklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialIntegration_workspaceId_idx" ON "SocialIntegration"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialIntegration_workspaceId_platform_key" ON "SocialIntegration"("workspaceId", "platform");

-- CreateIndex
CREATE INDEX "SocialAccount_handle_idx" ON "SocialAccount"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_platform_externalId_key" ON "SocialAccount"("platform", "externalId");

-- CreateIndex
CREATE INDEX "SocialAttributionHandle_workspaceId_idx" ON "SocialAttributionHandle"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAttributionHandle_workspaceId_platform_handle_key" ON "SocialAttributionHandle"("workspaceId", "platform", "handle");

-- CreateIndex
CREATE INDEX "SocialPost_socialAccountId_idx" ON "SocialPost"("socialAccountId");

-- CreateIndex
CREATE INDEX "SocialPost_extractedUrls_idx" ON "SocialPost" USING GIN ("extractedUrls");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_platform_externalId_key" ON "SocialPost"("platform", "externalId");

-- CreateIndex
CREATE INDEX "SocialKeyword_workspaceId_idx" ON "SocialKeyword"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialKeyword_workspaceId_term_matchType_key" ON "SocialKeyword"("workspaceId", "term", "matchType");

-- CreateIndex
CREATE INDEX "SocialMention_workspaceId_firstMatchedAt_idx" ON "SocialMention"("workspaceId", "firstMatchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMention_workspaceId_socialPostId_key" ON "SocialMention"("workspaceId", "socialPostId");

-- CreateIndex
CREATE INDEX "LinkAttribution_workspaceId_socialPostId_idx" ON "LinkAttribution"("workspaceId", "socialPostId");

-- CreateIndex
CREATE INDEX "LinkAttribution_workspaceId_socialAccountId_idx" ON "LinkAttribution"("workspaceId", "socialAccountId");

-- CreateIndex
CREATE INDEX "LinkAttribution_workspaceId_visitorId_idx" ON "LinkAttribution"("workspaceId", "visitorId");

-- CreateIndex
CREATE INDEX "LinkAttribution_workspaceId_matchedAt_idx" ON "LinkAttribution"("workspaceId", "matchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkAttribution_eventId_key" ON "LinkAttribution"("eventId");

-- CreateIndex
CREATE INDEX "SocialSyncJob_workspaceId_jobType_status_idx" ON "SocialSyncJob"("workspaceId", "jobType", "status");

-- CreateIndex
CREATE INDEX "WorkspaceDomain_workspaceId_idx" ON "WorkspaceDomain"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceDomain_workspaceId_domain_key" ON "WorkspaceDomain"("workspaceId", "domain");

-- CreateIndex
CREATE INDEX "AccountBlocklist_workspaceId_idx" ON "AccountBlocklist"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBlocklist_workspaceId_platform_blockedAccountExterna_key" ON "AccountBlocklist"("workspaceId", "platform", "blockedAccountExternalId");

-- AddForeignKey
ALTER TABLE "SocialIntegration" ADD CONSTRAINT "SocialIntegration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAttributionHandle" ADD CONSTRAINT "SocialAttributionHandle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_quotedPostId_fkey" FOREIGN KEY ("quotedPostId") REFERENCES "SocialPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialKeyword" ADD CONSTRAINT "SocialKeyword_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMention" ADD CONSTRAINT "SocialMention_socialKeywordId_fkey" FOREIGN KEY ("socialKeywordId") REFERENCES "SocialKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkAttribution" ADD CONSTRAINT "LinkAttribution_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkAttribution" ADD CONSTRAINT "LinkAttribution_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkAttribution" ADD CONSTRAINT "LinkAttribution_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceDomain" ADD CONSTRAINT "WorkspaceDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountBlocklist" ADD CONSTRAINT "AccountBlocklist_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
