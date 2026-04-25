export type EntityType = "company" | "person" | "brand" | "team" | "product" | "org" | "other";
export type ShapePref = "square" | "circle" | "auto";

export interface ResolvedEntity {
  slug: string;
  count: number;
  shape_hint: "square" | "circle";
  size_hint: number;
  resolved: boolean;
  logo_url?: string;
  display_name?: string;
}
