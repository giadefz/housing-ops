export function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

/** Thrown when a datastore has not been initialized for a workspace. */
export class StoreNotInitializedError extends Error {
	constructor(root: string) {
		super(`no datastore under ${root} — run housing-ops setup`);
		this.name = "StoreNotInitializedError";
	}
}
