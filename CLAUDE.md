See [AGENTS.md](./AGENTS.md) for project context, architecture, design
tokens, and the landmines to avoid.

Two things that cause silent, user-visible breakage if missed, repeated
here because they are worth reading twice:

1. **`components/tweet-preview.tsx` pins its geometry with inline styles
   on purpose.** It is the `html-to-image` capture target, so anything
   it inherits from the Tailwind theme is baked into users' exported
   PNGs. Emptying the theme's radius scale once turned every exported
   avatar into a square — compiling clean, with CI green.

2. **Generated slides and carousels are not app chrome.** They render in
   an iframe or via Puppeteer, never see this stylesheet, and must not
   be swept by style or color changes. The excluded paths are listed in
   AGENTS.md.
