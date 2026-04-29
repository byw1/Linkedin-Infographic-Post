// Detects probable duplicates inside a single user's library so the
// /library suggestion strip can offer to merge them. Conservative on
// purpose — we'd rather miss a real duplicate than offer a bad merge,
// because the merge collapses two rows into one and the user has to
// re-upload to undo it.
//
// Signal set (any one is enough to flag a group):
//   1. Same normalized display name — case + whitespace insensitive.
//      Highest-precision signal in practice.
//   2. Same source URL — only fires when both rows were uploaded
//      from the same web URL, which almost always means the same
//      brand. Rare but very high precision.
//
// Out of scope for V1: slug edit-distance similarity (`sam-altman`
// vs `samaltman`). It generates more false positives than wins given
// the team can already use aliases instead of separate entries.

export interface DuplicateCandidate {
  id: string;
  slug: string;
  aliases: string[];
  displayName: string;
  shapePreference: "square" | "circle" | "auto";
  logoUrl: string;
  usageCount: number;
  sourceUrl: string | null;
}

export interface DuplicateGroup {
  // Stable id derived from the member ids so the client can persist
  // dismissals by group later if we want to.
  id: string;
  reason: "same-display-name" | "same-source-url";
  members: DuplicateCandidate[];
}

export function findDuplicateGroups(
  entities: DuplicateCandidate[],
): DuplicateGroup[] {
  const byName = new Map<string, DuplicateCandidate[]>();
  const bySource = new Map<string, DuplicateCandidate[]>();

  for (const e of entities) {
    const nameKey = normalizeDisplayName(e.displayName);
    if (nameKey) {
      const arr = byName.get(nameKey);
      if (arr) arr.push(e);
      else byName.set(nameKey, [e]);
    }
    if (e.sourceUrl) {
      const sourceKey = e.sourceUrl.split("?")[0].replace(/\/+$/, "");
      const arr = bySource.get(sourceKey);
      if (arr) arr.push(e);
      else bySource.set(sourceKey, [e]);
    }
  }

  const seen = new Set<string>();
  const groups: DuplicateGroup[] = [];

  for (const [, members] of byName) {
    if (members.length < 2) continue;
    const id = groupKey(members);
    if (seen.has(id)) continue;
    seen.add(id);
    groups.push({ id, reason: "same-display-name", members });
  }

  for (const [, members] of bySource) {
    if (members.length < 2) continue;
    const id = groupKey(members);
    if (seen.has(id)) continue;
    seen.add(id);
    groups.push({ id, reason: "same-source-url", members });
  }

  // Most-actionable groups first: the ones with the most usage to
  // collapse rise to the top.
  groups.sort((a, b) => totalUsage(b) - totalUsage(a));

  return groups;
}

export function normalizeDisplayName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function groupKey(members: DuplicateCandidate[]): string {
  return members
    .map((m) => m.id)
    .slice()
    .sort()
    .join("|");
}

function totalUsage(group: DuplicateGroup): number {
  return group.members.reduce((sum, m) => sum + m.usageCount, 0);
}
