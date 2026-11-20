// Scene rewrite workflow: "the LLM proposes, the code verifies, the author decides".
//   1. Refuse a locked scene (the author asked the AI not to touch it).
//   2. Ask the model for 1 or 3 versions of the scene: words only (title, emoji, mood, text,
//      choice labels and emojis, ending label). The schema has no choice targets at all.
//   3. Check every version keeps the structure: exactly the same choice ids, in order, and an
//      ending label if and only if the scene is an ending. Retry once with the problems.
//   4. Return the proposals; the client shows a before/after preview and the author keeps
//      one (undoable) or cancels. The merge keeps the original ids and targets, so the
//      destinations of the choices can never change.
import { normalizeEmoji } from "@shared/emoji";
import type { Scene, SceneRewrite, Story } from "@shared/schema";
import { HttpError } from "./errors";
import type { ModelMessage, ModelUsage } from "./generate";
import { buildRewriteInput } from "./prompts";

export type CallRewriteModel = (
  messages: ModelMessage[],
) => Promise<{ variants: SceneRewrite[]; usage: ModelUsage }>;

export interface RewriteResult {
  variants: SceneRewrite[];
  attempts: number;
  usage: ModelUsage;
}

/** Problems with the proposals, in French (sent back to the model on retry). */
export function checkRewrites(variants: SceneRewrite[], scene: Scene, wanted: number): string[] {
  const problems: string[] = [];
  if (variants.length === 0) problems.push(`Aucune variante : il en faut ${wanted}.`);
  const expectedIds = scene.choices.map((c) => c.id).join(", ") || "aucun";

  variants.slice(0, wanted).forEach((variant, i) => {
    const n = `Variante ${i + 1}`;
    const ids = variant.choices.map((c) => c.id).join(", ") || "aucun";
    if (ids !== expectedIds) {
      problems.push(
        `${n} : les choix doivent être exactement [${expectedIds}] dans cet ordre (reçu : [${ids}]).`,
      );
    }
    if (variant.choices.some((c) => !c.label.trim()))
      problems.push(`${n} : un choix n'a pas de libellé.`);
    if (!variant.title.trim()) problems.push(`${n} : le titre est vide.`);
    if (!variant.text.trim()) problems.push(`${n} : le texte est vide.`);
    if (scene.ending && !variant.endingLabel?.trim()) {
      problems.push(`${n} : c'est une fin, "endingLabel" doit être rempli.`);
    }
    if (!scene.ending && variant.endingLabel !== null) {
      problems.push(`${n} : ce n'est pas une fin, "endingLabel" doit valoir null.`);
    }
  });
  return problems;
}

/** Cosmetic fixes that do not need the model: trimmed texts, single valid emojis. */
function tidy(variant: SceneRewrite): SceneRewrite {
  return {
    ...variant,
    title: variant.title.trim(),
    text: variant.text.trim(),
    emoji: normalizeEmoji(variant.emoji),
    choices: variant.choices.map((c) => ({
      ...c,
      label: c.label.trim(),
      emoji: normalizeEmoji(c.emoji),
      outcome: c.outcome.trim(),
    })),
    endingLabel: variant.endingLabel?.trim() ?? null,
  };
}

export async function rewriteScene(
  story: Story,
  sceneId: string,
  instruction: string,
  wanted: 1 | 3,
  callModel: CallRewriteModel,
): Promise<RewriteResult> {
  const scene = story.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new HttpError(400, "Cette scène n'existe pas dans l'histoire.");
  if (scene.locked) {
    throw new HttpError(
      409,
      "Cette scène est verrouillée 🔒 : déverrouille-la pour la retravailler.",
    );
  }

  const messages: ModelMessage[] = [
    { role: "user", content: buildRewriteInput(story, scene, instruction, wanted) },
  ];
  const usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };

  const MAX_ATTEMPTS = 2; // first try + one retry
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await callModel(messages);
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;

    const problems = checkRewrites(result.variants, scene, wanted);
    if (problems.length === 0) {
      return { variants: result.variants.slice(0, wanted).map(tidy), attempts: attempt, usage };
    }
    console.warn("[rewrite] propositions refusées :", problems);
    messages.push({ role: "assistant", content: JSON.stringify(result.variants) });
    messages.push({
      role: "user",
      content: `Ta réponse ne respecte pas les règles :\n${problems.map((p) => `- ${p}`).join("\n")}\n\nRenvoie les variantes corrigées.`,
    });
  }
  throw new HttpError(
    422,
    "L'IA n'a pas respecté la structure de la scène après deux essais. Réessaie.",
  );
}
