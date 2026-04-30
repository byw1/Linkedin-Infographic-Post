-- Whether this user's tracked posts surface on the team-wide feed
-- (Wins, /posts team tab, member-card top posts). Default true so
-- the social-feedback loop is on out of the box; users opt out
-- from /settings.
ALTER TABLE "users"
  ADD COLUMN "share_tracked" BOOLEAN NOT NULL DEFAULT TRUE;
