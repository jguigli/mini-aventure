// API server entry point.
// Its main job: keep the OpenAI key on the server (it is never sent to the client).
import express from "express";
import { API_HEALTH_PATH, type HealthResponse } from "@shared/api";
import { env, hasOpenAiKey } from "./env";

const app = express();
app.use(express.json({ limit: "200kb" }));

// Health check: only reports whether the key is set, never the key itself.
app.get(API_HEALTH_PATH, (_req, res) => {
  const body: HealthResponse = { ok: true, openaiKey: hasOpenAiKey() };
  res.json(body);
});

// This port only serves the API: point to the UI instead of showing "Cannot GET /".
app.get("/", (_req, res) => {
  res
    .type("text")
    .send(
      `API Mini-aventure. L'application est sur http://localhost:5173 (santé : ${API_HEALTH_PATH}).`,
    );
});

// Any other unknown /api route: clean JSON error instead of Express's HTML page.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Route inconnue." });
});

app.listen(env.port, () => {
  console.log(`[server] API prête sur http://localhost:${env.port}`);
  // Missing key: clear message, but the server keeps running.
  if (!hasOpenAiKey()) {
    console.warn("[server] ⚠️  Clé manquante : renseigne server/.env (OPENAI_API_KEY).");
  }
});
