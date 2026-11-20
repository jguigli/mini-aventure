// Chargement de la configuration depuis server/.env.
// Le chemin est résolu par rapport à ce fichier, pour fonctionner quel que soit
// le dossier d'où le serveur est lancé (racine du monorepo ou server/).
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

export const env = {
  port: Number(process.env.PORT) || 3001,
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
  openaiModel: process.env.OPENAI_MODEL?.trim() || null,
};

/** Vrai si une clé OpenAI est renseignée. On ne vérifie pas sa validité ici. */
export const hasOpenAiKey = (): boolean => env.openaiApiKey !== null;
