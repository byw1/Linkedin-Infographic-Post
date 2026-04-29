-- Markdown skill files admins upload for the team. The bytes live in
-- S3 (storage_key); this row stores the metadata.
CREATE TABLE "skills" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"           TEXT         NOT NULL,
  "description"    TEXT,
  "filename"       TEXT         NOT NULL,
  "storage_key"    TEXT         NOT NULL,
  "file_size"      INTEGER      NOT NULL,
  "uploaded_by_id" UUID         NOT NULL,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "skills_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id")
    REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_skills_created" ON "skills" ("created_at" DESC);
