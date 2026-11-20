// Point d'entrée du serveur API.
// Son rôle principal : garder la clé OpenAI côté serveur (elle n'est jamais envoyée au client).
import express from "express";
import { API_HEALTH_PATH, type HealthResponse } from "@shared/api";
import { env, hasOpenAiKey } from "./env";

const app = express();
app.use(express.json({ limit: "200kb" }));

// Santé de l'API : indique seulement si la clé est présente, sans jamais l'afficher.
app.get(API_HEALTH_PATH, (_req, res) => {
  const body: HealthResponse = { ok: true, openaiKey: hasOpenAiKey() };
  res.json(body);
});

// Ce port ne sert que l'API : on indique où est l'interface plutôt qu'afficher « Cannot GET / ».
app.get("/", (_req, res) => {
  res
    .type("text")
    .send(
      `API Mini-aventure. L'application est sur http://localhost:5173 (santé : ${API_HEALTH_PATH}).`,
    );
});

// Toute autre route /api inconnue : erreur JSON propre plutôt que la page HTML d'Express.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Route inconnue." });
});

app.listen(env.port, () => {
  console.log(`[server] API prête sur http://localhost:${env.port}`);
  // Clé absente : message clair, mais le serveur continue de tourner.
  if (!hasOpenAiKey()) {
    console.warn("[server] ⚠️  Clé manquante : renseigne server/.env (OPENAI_API_KEY).");
  }
});
