-- CreateTable
CREATE TABLE "mail_events" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sender_email" TEXT NOT NULL,
    "sender_name" TEXT,
    "recipients" TEXT[],
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "error_message" TEXT,
    "original_bytes" INTEGER,
    "rewritten_bytes" INTEGER,

    CONSTRAINT "mail_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_events_created_at_idx" ON "mail_events"("created_at");
