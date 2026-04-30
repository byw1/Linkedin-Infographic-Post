-- Access requests submitted from /welcome/request. Admins review
-- in /admin/access-requests; approval issues an Invite via the
-- existing flow and emails the link to the requester.

CREATE TYPE "AccessRequestStatus" AS ENUM ('pending', 'approved', 'declined');

CREATE TABLE "access_requests" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"           TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "linkedin"       TEXT NOT NULL,
  "industry"       TEXT NOT NULL,
  "skills"         TEXT NOT NULL,
  "referrer"       TEXT NOT NULL,
  "status"         "AccessRequestStatus" NOT NULL DEFAULT 'pending',
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by_id" UUID,
  "reviewed_at"    TIMESTAMPTZ(6),
  "invite_id"      UUID,
  CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_access_requests_status" ON "access_requests" ("status", "created_at" DESC);

-- SetNull on reviewer delete: if the admin account is removed we
-- still want the historical row, just without authorship.
ALTER TABLE "access_requests"
  ADD CONSTRAINT "access_requests_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
