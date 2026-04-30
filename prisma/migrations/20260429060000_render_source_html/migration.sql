-- Persist source HTML per render so a past post can be re-opened
-- in the editor (Remix) without re-uploading from Claude.
-- `source_html` shape is `{ slides: [{ filename, html }] }` for both
-- formats — single posts get a 1-element array, carousels keep
-- their full deck. `format` is "single" | "carousel"; null on
-- legacy rows predating this migration (Remix is hidden for those).
ALTER TABLE "renders"
  ADD COLUMN "source_html" JSONB,
  ADD COLUMN "format" TEXT;
