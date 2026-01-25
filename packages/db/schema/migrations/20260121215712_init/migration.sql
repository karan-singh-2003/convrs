-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'member', 'viewer', 'billing');

-- CreateTable
CREATE TABLE "jackson_index" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(250) NOT NULL,
    "storeKey" VARCHAR(250) NOT NULL,

    CONSTRAINT "jackson_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jackson_store" (
    "key" VARCHAR(250) NOT NULL,
    "value" TEXT NOT NULL,
    "iv" VARCHAR(64),
    "tag" VARCHAR(64),
    "namespace" VARCHAR(64),
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedAt" TIMESTAMP(0),

    CONSTRAINT "jackson_store_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "jackson_ttl" (
    "key" VARCHAR(250) NOT NULL,
    "expiresAt" BIGINT NOT NULL,

    CONSTRAINT "jackson_ttl_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "inviteCode" TEXT,
    "ssoEmailDomain" TEXT,
    "ssoEnforcedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usageLastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "email" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkspaceUsers" (
    "id" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'member',
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspacePreferences" JSONB,
    "defaultFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceUsers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentEmail" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT,

    CONSTRAINT "SentEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "_jackson_index_key_store" ON "jackson_index"("key", "storeKey");

-- CreateIndex
CREATE INDEX "_jackson_store_namespace" ON "jackson_store"("namespace");

-- CreateIndex
CREATE INDEX "_jackson_ttl_expires_at" ON "jackson_ttl"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_identifier_token_key" ON "EmailVerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_identifier_token_key" ON "PasswordResetToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_inviteCode_key" ON "Workspace"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_ssoEmailDomain_key" ON "Workspace"("ssoEmailDomain");

-- CreateIndex
CREATE INDEX "Workspace_usageLastChecked_idx" ON "Workspace"("usageLastChecked" ASC);

-- CreateIndex
CREATE INDEX "WorkspaceInvite_workspaceId_idx" ON "WorkspaceInvite"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_email_workspaceId_key" ON "WorkspaceInvite"("email", "workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceUsers_workspaceId_idx" ON "WorkspaceUsers"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceUsers_userId_workspaceId_key" ON "WorkspaceUsers"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "SentEmail_workspaceId_idx" ON "SentEmail"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceUsers" ADD CONSTRAINT "WorkspaceUsers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceUsers" ADD CONSTRAINT "WorkspaceUsers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentEmail" ADD CONSTRAINT "SentEmail_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
