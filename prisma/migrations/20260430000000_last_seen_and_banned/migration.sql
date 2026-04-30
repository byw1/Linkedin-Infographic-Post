-- Track activity (set on every authenticated request, throttled to
-- once per ~5 minutes) so /members can show "active 2h ago".
ALTER TABLE "users"
  ADD COLUMN "last_seen_at" TIMESTAMPTZ(6);

-- Soft-ban: non-null = banned. Sign-in is rejected and non-admin
-- listings hide the row. Reversible by an admin.
ALTER TABLE "users"
  ADD COLUMN "banned_at" TIMESTAMPTZ(6);
