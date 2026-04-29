-- Public profile columns surfaced on the Members page.
-- tags: free-form labels (industry, focus areas) shown as chips.
-- bio: short text describing the user.
-- socials: { provider: url } map, normalized to absolute https on write.
ALTER TABLE "users"
  ADD COLUMN "tags"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bio"     TEXT,
  ADD COLUMN "socials" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- GIN index so "find members tagged X" filters stay cheap as the team
-- grows.
CREATE INDEX "idx_users_tags" ON "users" USING GIN ("tags");
