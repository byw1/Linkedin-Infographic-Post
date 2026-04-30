-- Per-user hide overrides for the now community-wide entity library.
-- Adding a row here suppresses a slug from one user's /library +
-- pickers without affecting anyone else; parse-time resolution
-- still finds it. Slug-keyed (not entity-id) so a hide survives
-- if the original row is deleted and another member uploads a new
-- entity under the same slug — the user's intent persists.
CREATE TABLE "entity_hidden" (
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "slug"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "slug")
);

CREATE INDEX "idx_entity_hidden_slug" ON "entity_hidden" ("slug");
