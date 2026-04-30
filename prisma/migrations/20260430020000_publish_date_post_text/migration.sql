-- Track when the user actually posted on the platform (separate
-- from createdAt = render generated, trackedAt = metrics logged).
-- Drives the 7-day community-feed eligibility gate.
ALTER TABLE "renders"
  ADD COLUMN "published_at" TIMESTAMPTZ(6);

-- Original LinkedIn post body. Long-form so we can store full
-- carousels caption / hook + body + CTA without truncation.
ALTER TABLE "renders"
  ADD COLUMN "post_text" TEXT;
