-- Manual post-tracking fields filled in by the user after they
-- actually publish a render somewhere. Kept as discrete columns
-- rather than a JSON blob so future "top posts by impressions" /
-- leaderboard queries can sort and aggregate without parsing.
ALTER TABLE "renders"
  ADD COLUMN "post_url"    TEXT,
  ADD COLUMN "impressions" INTEGER,
  ADD COLUMN "reactions"   INTEGER,
  ADD COLUMN "comments"    INTEGER,
  ADD COLUMN "reposts"     INTEGER,
  ADD COLUMN "tracked_at"  TIMESTAMPTZ(6);
