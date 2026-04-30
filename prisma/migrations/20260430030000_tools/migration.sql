-- LinkedIn-adjacent tools the team relies on. Admin-managed
-- catalog browsable by members at /docs/tools.
CREATE TABLE "tools" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "description" TEXT,
  "tags"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "logo_url"    TEXT,
  "position"    INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_tools_position" ON "tools" ("position");
CREATE INDEX "idx_tools_tags" ON "tools" USING GIN ("tags");
