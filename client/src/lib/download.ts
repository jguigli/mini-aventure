// File downloads. Exports are always produced from the CURRENT source at click time,
// so a download contains the latest edit even if the live check has not run yet.
import { slugify } from "./storyEdits";

/** "Le phare qui murmure" → "le-phare-qui-murmure" (then .ink / .json). */
export function fileBaseName(title: string): string {
  return slugify(title, "-") || "aventure";
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
