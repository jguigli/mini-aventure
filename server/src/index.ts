// API server entry point.
// Its main job: keep the OpenAI key on the server (it is never sent to the client).
import express, { type ErrorRequestHandler } from "express";
import {
  API_GENERATE_PATH,
  API_HEALTH_PATH,
  GenerateRequest,
  type GenerateResponse,
  type HealthResponse,
} from "@shared/api";
import { env, hasOpenAiKey, modelName } from "./env";
import { toHttpError } from "./errors";
import { generateStory, InvalidStoryError } from "./generate";
import { callOpenAiForStory } from "./openai";

const app = express();
app.use(express.json({ limit: "200kb" }));

// Health check: only reports whether the key is set, never the key itself.
app.get(API_HEALTH_PATH, (_req, res) => {
  const body: HealthResponse = { ok: true, openaiKey: hasOpenAiKey() };
  res.json(body);
});

// Story generation: validate the input, call the LLM (with one retry if the structure is wrong),
// and log duration + tokens to keep an eye on the budget.
app.post(API_GENERATE_PATH, async (req, res) => {
  const input = GenerateRequest.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.issues[0]?.message ?? "Requête invalide." });
    return;
  }

  const started = Date.now();
  const seconds = () => ((Date.now() - started) / 1000).toFixed(1);
  try {
    const { story, attempts, usage, warnings } = await generateStory(
      input.data.idea,
      input.data.readingLevel,
      callOpenAiForStory,
    );
    console.log(
      `[generate] OK en ${seconds()} s, ${attempts} essai(s), modèle ${modelName()}, ` +
        `tokens entrée ${usage.inputTokens} / sortie ${usage.outputTokens}, « ${story.title} »` +
        (warnings.length > 0 ? `, ${warnings.length} problème(s) laissé(s) à l'auteur` : ""),
    );
    if (warnings.length > 0) console.warn("[generate] problèmes réparables :", warnings);
    const body: GenerateResponse = { story, warnings };
    res.json(body);
  } catch (error) {
    const httpError = toHttpError(error);
    console.error(`[generate] échec en ${seconds()} s (${httpError.status}) :`, error);
    if (error instanceof InvalidStoryError)
      console.error("[generate] problèmes restants :", error.issues);
    res.status(httpError.status).json({ error: httpError.message });
  }
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

// Malformed or oversized JSON bodies: JSON error instead of Express's HTML page.
const jsonErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Le corps de la requête n'est pas un JSON valide." });
  } else if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "La requête est trop volumineuse." });
  } else {
    next(error);
  }
};
app.use(jsonErrorHandler);

app.listen(env.port, () => {
  console.log(`[server] API prête sur http://localhost:${env.port} (modèle : ${modelName()})`);
  // Missing key: clear message, but the server keeps running.
  if (!hasOpenAiKey()) {
    console.warn("[server] ⚠️  Clé manquante : renseigne server/.env (OPENAI_API_KEY).");
  }
});
