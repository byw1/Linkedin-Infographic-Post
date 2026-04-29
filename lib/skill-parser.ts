// Pulls `name:` and `description:` from a YAML frontmatter block at the
// top of a Claude skill .md file. Frontmatter looks like:
//
//   ---
//   name: linkedin-viral-posts
//   description: Use this skill to create high-converting LinkedIn posts...
//   ---
//
// Description can be a single line or a folded multi-line value (typical
// for Claude skills, which write long blurbs). We treat everything from
// `description:` to the next top-level `key:` line (or the closing `---`)
// as the description, then collapse internal whitespace.
export interface SkillFrontmatter {
  name: string | null;
  description: string | null;
}

export function parseSkillFrontmatter(markdown: string): SkillFrontmatter {
  const trimmed = markdown.replace(/^﻿/, "");
  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: null, description: null };
  const body = match[1];

  const fields = new Map<string, string>();
  const lines = body.split(/\r?\n/);
  let currentKey: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (currentKey) {
      fields.set(currentKey, buffer.join("\n").trim());
    }
    currentKey = null;
    buffer = [];
  };

  for (const line of lines) {
    // A "top-level key" looks like `key: ...` at the start of a line. The
    // skill files we expect have flat keys; we don't attempt full YAML.
    const keyMatch = line.match(/^([a-zA-Z][\w-]*):\s?(.*)$/);
    if (keyMatch) {
      flush();
      currentKey = keyMatch[1];
      const initial = keyMatch[2].trim();
      if (initial) buffer.push(initial);
    } else if (currentKey) {
      // Continuation line — keep its content with leading whitespace
      // stripped, so folded paragraphs read naturally.
      buffer.push(line.replace(/^\s+/, ""));
    }
  }
  flush();

  const rawDescription = fields.get("description") ?? null;
  return {
    name: fields.get("name") ?? null,
    description: rawDescription ? rawDescription.replace(/\s+/g, " ").trim() : null,
  };
}
