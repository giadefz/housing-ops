/** Reads a message from any thrown value. */
export function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
