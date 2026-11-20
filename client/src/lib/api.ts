// Client side of the API. Every failure becomes an ApiClientError with a French message
// that can be shown as is. The server already validated the story; we parse it again with
// zod so the client never trusts an unexpected shape.
import {
  API_GENERATE_PATH,
  API_REWRITE_PATH,
  type GenerateRequest,
  type GenerateResponse,
  type RewriteRequest,
  type RewriteResponse,
} from "@shared/api";
import { SceneRewrite, Story } from "@shared/schema";

export class ApiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

const SERVER_DOWN = "Impossible de joindre le serveur. Vérifie que « make dev » tourne.";

/** POSTs JSON and returns the parsed body, or throws an ApiClientError (French message). */
async function postJson(path: string, payload: unknown, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
  return body;
}

const UNEXPECTED = "Le serveur a renvoyé une réponse inattendue.";

export async function requestStory(
  request: GenerateRequest,
  signal?: AbortSignal,
): Promise<{ story: Story; warnings: GenerateResponse["warnings"] }> {
  const data = (await postJson(
    API_GENERATE_PATH,
    request,
    signal,
  )) as Partial<GenerateResponse> | null;
  const story = Story.safeParse(data?.story);
  if (!story.success) throw new ApiClientError(UNEXPECTED);
  // Warnings are informative only (the editor recomputes every check live).
  return { story: story.data, warnings: Array.isArray(data?.warnings) ? data.warnings : [] };
}

export async function requestRewrite(
  request: RewriteRequest,
  signal?: AbortSignal,
): Promise<SceneRewrite[]> {
  const data = (await postJson(
    API_REWRITE_PATH,
    request,
    signal,
  )) as Partial<RewriteResponse> | null;
  const variants = SceneRewrite.array().min(1).safeParse(data?.variants);
  if (!variants.success) throw new ApiClientError(UNEXPECTED);
  return variants.data;
}
