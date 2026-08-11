-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "domainId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "diagnostics" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailEvent_messageId_key" ON "EmailEvent"("messageId");

-- CreateIndex
CREATE INDEX "EmailEvent_domainId_timestamp_idx" ON "EmailEvent"("domainId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "EmailEvent_eventType_timestamp_idx" ON "EmailEvent"("eventType", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "EmailEvent_messageId_idx" ON "EmailEvent"("messageId");

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
