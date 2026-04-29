-- Additional slugs that resolve to the same entity. Empty array by
-- default; updated by users via PATCH /api/entities/:slug or
-- automatically when an entity's canonical slug is renamed.
ALTER TABLE "entities"
  ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- GIN index so alias lookups (used by /api/parse and /api/parse-batch)
-- stay cheap as users accumulate logos. The per-user filter applied on
-- top of this still uses idx_entities_user_slug.
CREATE INDEX "idx_entities_aliases" ON "entities" USING GIN ("aliases");
