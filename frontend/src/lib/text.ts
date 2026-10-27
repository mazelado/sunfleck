/** "swiss cheese plant" → "Swiss cheese plant" (common names are stored in lower case). */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
