// File export: the .ink is always serialized from the CURRENT JSON at click time,
// so the download contains the latest edit even if the live check has not run yet.
import type { Story } from "@shared/schema";
import { storyToInk } from "./inkSerializer";
import { slugify } from "./storyEdits";

/** "Le phare qui murmure" → "le-phare-qui-murmure.ink" */
export function inkFileName(title: string): string {
  return `${slugify(title, "-") || "aventure"}.ink`;
}

export function downloadText(fileName: string, content: string, type = "text/plain"): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Give the browser time to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportInk(story: Story): void {
  downloadText(inkFileName(story.title), storyToInk(story));
}
