// API contract shared by the client and the server.
// Imported on both sides through the `@shared/*` alias: if this file compiles
// in both apps, the alias is set up correctly.

export const API_HEALTH_PATH = "/api/health";

/** GET /api/health response. Never contains the key, only whether it is set. */
export interface HealthResponse {
  ok: true;
  openaiKey: boolean;
}

/** Common shape of API errors (the message itself is in French, shown in the UI). */
export interface ApiError {
  error: string;
}
