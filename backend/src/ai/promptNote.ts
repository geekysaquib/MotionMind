/** The creator's own instructions for a copy-paste prompt ("make it shorter", "explain it for beginners"), from `?note=`. */
export const MAX_NOTE = 1500;

export function noteOf(query: unknown): string {
  const raw = (query as { note?: unknown } | null | undefined)?.note;
  return typeof raw === 'string' ? raw.trim().slice(0, MAX_NOTE) : '';
}

/** Adds the creator's instructions to the end of a prompt, where they win over the defaults above them. */
export function withNote(prompt: string, note: string): string {
  if (!note) return prompt;
  return `${prompt}\n\n---\nEXTRA INSTRUCTIONS FROM THE CREATOR. Follow these. Where they conflict with the defaults above, these win, but keep the required answer format exactly as described:\n${note}\n`;
}
