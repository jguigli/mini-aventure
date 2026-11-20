// Runs analyzeStory ~300 ms after the last change (debounced), so typing stays smooth.
// `checkNow()` skips the wait (the « Vérifier » button).
import { useCallback, useEffect, useState } from "react";
import type { Story } from "@shared/schema";
import { analyzeStory, type StoryAnalysis } from "../lib/analysis";

export const ANALYSIS_DELAY_MS = 300;

export function useStoryAnalysis(story: Story): {
  analysis: StoryAnalysis;
  pending: boolean;
  checkNow: () => void;
} {
  // First analysis is synchronous, so the map never renders without statuses.
  const [state, setState] = useState(() => ({ story, analysis: analyzeStory(story) }));

  useEffect(() => {
    if (state.story === story) return;
    const timer = setTimeout(
      () => setState({ story, analysis: analyzeStory(story) }),
      ANALYSIS_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [story, state.story]);

  const checkNow = useCallback(() => setState({ story, analysis: analyzeStory(story) }), [story]);

  return { analysis: state.analysis, pending: state.story !== story, checkNow };
}
