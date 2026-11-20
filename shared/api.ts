// Contrat de l'API partagé entre le client et le serveur.
// Importé des deux côtés via l'alias `@shared/*` : si ce fichier compile
// dans les deux applications, l'alias est correctement configuré.

export const API_HEALTH_PATH = "/api/health";

/** Réponse de GET /api/health. Ne contient jamais la clé, seulement sa présence. */
export interface HealthResponse {
  ok: true;
  openaiKey: boolean;
}

/** Format commun des erreurs renvoyées par l'API (message en français). */
export interface ApiError {
  error: string;
}
