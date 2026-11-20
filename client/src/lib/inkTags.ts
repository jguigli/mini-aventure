// Ink tags written by our serializer are "key: value" strings (e.g. "scene: phare").

/** Value of a "key: value" tag, if present among `tags`. The last one wins. */
export function tagValue(tags: string[], key: string): string | null {
  let value: string | null = null;
  for (const tag of tags) {
    const match = tag.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (match && match[1] === key) value = match[2];
  }
  return value;
}
