-- Group doc pages into sections — a "Part I: How LinkedIn works"
-- header that holds multiple pages in a collapsible sidebar
-- block. Free-form so admins coin sections on the fly; null
-- pages land in an "Uncategorized" trailing bucket in the
-- sidebar.
ALTER TABLE "doc_pages"
  ADD COLUMN "section" TEXT;

CREATE INDEX "idx_doc_pages_section" ON "doc_pages" ("section");
