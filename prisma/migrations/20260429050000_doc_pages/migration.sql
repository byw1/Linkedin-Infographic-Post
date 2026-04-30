-- Wiki pages for the team handbook. Replaces the single-blob
-- `settings.docs` markdown with a page-per-topic structure.
--
-- The slug is unique + URL-safe and stable; users build links like
-- `/docs/posting-workflow` against it. `position` orders the
-- sidebar (low first); we don't bother compacting gaps on delete.
-- `updated_by_id` is SET NULL on author deletion so a page survives
-- after a teammate leaves.
CREATE TABLE "doc_pages" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"           TEXT UNIQUE NOT NULL,
  "title"          TEXT NOT NULL,
  "markdown"       TEXT NOT NULL,
  "position"       INTEGER NOT NULL DEFAULT 0,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_id"  UUID REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_doc_pages_position" ON "doc_pages" ("position");

-- One-time migration of the previous single markdown blob into a
-- starter page. If the workspace already customized
-- `settings.docs`, copy that markdown verbatim into a "Handbook"
-- page so nothing is lost. If the workspace was still on the
-- default starter, seed a single empty welcome page so the new
-- /docs surface isn't empty on first load — admin can rename or
-- replace it from the UI.
DO $migration$
DECLARE
  existing_md TEXT;
BEGIN
  SELECT (value->>'markdown')::TEXT INTO existing_md
  FROM "settings"
  WHERE "key" = 'docs';

  IF existing_md IS NOT NULL AND length(existing_md) > 0 THEN
    INSERT INTO "doc_pages" ("slug", "title", "markdown", "position")
    VALUES ('handbook', 'Handbook', existing_md, 0);
  ELSE
    INSERT INTO "doc_pages" ("slug", "title", "markdown", "position")
    VALUES (
      'welcome',
      'Welcome',
      $$# Welcome

Team handbook lives here. Each topic is its own page in the sidebar;
admins can add new pages, rename them, reorder, or edit the markdown
inline.

## Get started

- Hit **Edit** on this page to replace the starter content.
- Hit **+ New page** in the sidebar to add another topic.
- Drop a Claude skill on the **Skills** entry at the bottom of the
  sidebar so the team can pick it up.
$$,
      0
    );
  END IF;
END $migration$;
