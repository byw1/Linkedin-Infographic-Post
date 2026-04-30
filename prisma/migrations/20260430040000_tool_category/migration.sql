-- Single primary category for tools — drives sectioning on
-- /docs/tools. Free-form so admins can invent categories on the
-- fly; null tools land in an "Uncategorized" bucket.
ALTER TABLE "tools"
  ADD COLUMN "category" TEXT;

CREATE INDEX "idx_tools_category" ON "tools" ("category");
