export type RenderStatus = "pending" | "rendering" | "complete" | "failed";

export interface RenderStatusResponse {
  id: string;
  status: RenderStatus;
  png_url: string | null;
  error_message: string | null;
}
