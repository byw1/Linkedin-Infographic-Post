// Default content shown on /docs when an admin hasn't customized it
// yet. Markdown — anything react-markdown + remark-gfm understands.
export const DEFAULT_DOCS = `# How we use viral

Notes the team should read once. Admins can edit this page (look for
the **Edit** button below the heading); everyone else gets a read-only
copy.

## What makes content actually viral

Stuff worth writing down here once we have a feel for it:

- **News first, plainly.** Lead the post with what happened. Save the
  why for the second sentence and the contradiction for the third.
- **One staggering stat per hook.** Don't cram every number into the
  opening — that's what the infographic is for.
- **Numbers are the point.** If a draft has no numbers, it's not this
  style.
- **Closers reframe.** End with one line that makes the reader see
  the whole thing differently.

Track which posts hit and add a sentence about *why* they hit. Future
us will thank present us.

## Generate an infographic with Claude + the viral-posts skill

1. **Install the skill** in Claude. The repo's \`public/skills/\` will
   host the latest \`linkedin-viral-posts.md\` file once we ship the
   skill page; until then, paste the skill text into a Claude Project's
   custom instructions.
2. **Give Claude the news story.** A link, a paragraph from a
   newsletter, or the raw earnings release works. Mention your
   LinkedIn handle so the credit line is right.
3. **Claude returns one HTML file.** It will already have
   \`data-entity="…"\` placeholders on every logo (green squares).
   Save it to disk.
4. **In viral**, switch to **New post → Infographic** and drop the
   HTML in.
5. **Resolve unknowns** by clicking the dashed boxes. Logos you've
   uploaded before auto-fill from the **Library**. Anything new only
   needs to be uploaded once — it'll auto-fill on every future post.
6. **Render PNG.** Download. Post.

## Generate a carousel with Claude + the skill

1. **Ask Claude for a carousel.** A typical brief: *"6 slides, 1080×1080
   each, one HTML file per slide, named \`01_…html\` through \`06_…html\`."*
2. **Claude returns 6 HTML files.** They share \`data-entity\` slugs
   wherever the same brand appears — so a logo only resolves once.
3. **Zip the files.** Just the \`.html\` files, no folder nesting.
4. **In viral**, switch to **New post → Carousel** and drop the
   \`.zip\` in.
5. **Step through the slides** with the ← / → buttons or click any
   placeholder to resolve it. Unresolved slugs across the whole
   carousel show as chips below the preview — click one to jump to
   the slide that contains it.
6. **Render PDF.** One page per slide, ready to upload as a LinkedIn
   document.

## Tips that aren't obvious

- **Aliases save you re-uploading.** If Claude names the same brand
  differently across posts (\`sama\` vs \`sam-altman\`), open the
  Library and add the alternate as an alias on the canonical entry.
  Same logo, same library row.
- **People are circles, companies are squares.** The skill knows this
  but Claude sometimes forgets — fix it in the HTML before rendering
  if it matters.
- **Charts need a moment.** If a slide has Chart.js, the carousel
  render waits ~1.5s for the animation to finish. If your chart's
  animation is longer, set \`options: { animation: false }\` in the
  Chart.js config and the snapshot will be instant + correct.
`;
