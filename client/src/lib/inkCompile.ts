// Ink compilation with the official inkjs compiler, in the browser.
// The compiler lives in "inkjs/full" (the default "inkjs" entry only has the runtime).
import { Compiler, type Story as InkStory } from "inkjs/full";

export type { InkStory };

export interface CompileResult {
  /** Playable story, or null when compilation failed. */
  story: InkStory | null;
  errors: string[];
  warnings: string[];
}

/**
 * Compiles Ink source. Never throws: inkjs throws "Compilation failed" on errors,
 * and we turn that into an `errors` list so the editor can show it without crashing.
 */
export function compileInk(source: string): CompileResult {
  const compiler = new Compiler(source);
  try {
    const story = compiler.Compile();
    return { story, errors: [...compiler.errors], warnings: [...compiler.warnings] };
  } catch (error) {
    // Normally the details are in compiler.errors; keep the exception message as a fallback.
    const errors =
      compiler.errors.length > 0
        ? [...compiler.errors]
        : [error instanceof Error ? error.message : String(error)];
    return { story: null, errors, warnings: [...compiler.warnings] };
  }
}
