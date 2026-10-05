/** Lowercases and collapses whitespace, for case-insensitive comparison of free text. */
export function normalizeText(text: string): string {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}
