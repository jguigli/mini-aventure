// Turns any error into an HTTP status + a French message the author can understand.
// Technical details go to the server log, never to the client.
import OpenAI from "openai";
import { InvalidStoryError } from "./generate";
import { modelName } from "./env";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (error instanceof InvalidStoryError) return new HttpError(422, error.message);

  // Order matters: the timeout error is a subclass of the connection error.
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new HttpError(504, "L'IA a mis trop de temps à répondre. Réessaie.");
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new HttpError(502, "Impossible de joindre OpenAI. Vérifie ta connexion internet.");
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new HttpError(
      502,
      "La clé OpenAI est refusée : vérifie OPENAI_API_KEY dans server/.env.",
    );
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new HttpError(429, "Quota OpenAI atteint ou trop de requêtes. Réessaie dans un moment.");
  }
  if (error instanceof OpenAI.NotFoundError) {
    return new HttpError(
      502,
      `Modèle « ${modelName()} » introuvable : vérifie OPENAI_MODEL dans server/.env.`,
    );
  }
  if (error instanceof OpenAI.APIError) {
    return new HttpError(502, "OpenAI a renvoyé une erreur. Réessaie dans un moment.");
  }
  return new HttpError(500, "Erreur inattendue du serveur.");
}
