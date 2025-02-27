-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "inputContent" TEXT NOT NULL,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceMetadata" (
    "id" TEXT NOT NULL,
    "author" TEXT,
    "publishDate" TIMESTAMP(3),
    "domain" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "summaryId" TEXT NOT NULL,

    CONSTRAINT "SourceMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMetrics" (
    "id" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "processingTime" DOUBLE PRECISION NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "summaryId" TEXT NOT NULL,

    CONSTRAINT "AIMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoSummary" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "inputContent" TEXT NOT NULL,

    CONSTRAINT "VideoSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceMetadata_summaryId_key" ON "SourceMetadata"("summaryId");

-- CreateIndex
CREATE UNIQUE INDEX "AIMetrics_summaryId_key" ON "AIMetrics"("summaryId");

-- AddForeignKey
ALTER TABLE "SourceMetadata" ADD CONSTRAINT "SourceMetadata_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "Summary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMetrics" ADD CONSTRAINT "AIMetrics_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "Summary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
