// Client side of the API. Every failure becomes an ApiClientError with a French message
// that can be shown as is. The server already validated the story; we parse it again with
// zod so the client never trusts an unexpected shape.
import { API_GENERATE_PATH, type GenerateRequest, type GenerateResponse } from "@shared/api";
import { Story } from "@shared/schema";

export class ApiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

const SERVER_DOWN = "Impossible de joindre le serveur. Vérifie que « make dev » tourne.";

export async function requestStory(
  request: GenerateRequest,
  signal?: AbortSignal,
): Promise<{ story: Story; warnings: GenerateResponse["warnings"] }> {
  let response: Response;
  try {
    response = await fetch(API_GENERATE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error; // cancelled by the author: not an error to display
    throw new ApiClientError(SERVER_DOWN);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: unknown } | null)?.error;
    if (typeof message === "string") throw new ApiClientError(message);
    // No JSON error: the Vite proxy could not reach the API server.
    throw new ApiClientError(response.status >= 500 ? SERVER_DOWN : `Erreur ${response.status}.`);
  }

  const data = body as Partial<GenerateResponse> | null;
  const story = Story.safeParse(data?.story);
  if (!story.success) throw new ApiClientError("Le serveur a renvoyé une réponse inattendue.");
  // Warnings are informative only (the editor recomputes every check live).
  return { story: story.data, warnings: Array.isArray(data?.warnings) ? data.warnings : [] };
}
