import type { ResolvedEntity } from "./entity";

export interface ParseResponse {
  hash: string;
  entities: ResolvedEntity[];
}

export interface RenderQueueResponse {
  render_id: string;
  status: "pending";
}
