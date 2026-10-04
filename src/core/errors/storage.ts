import { AppError } from "./app-error.js";

/** Thrown when a datastore has not been initialized for a workspace. */
export class StoreNotInitializedError extends AppError {
	constructor(root: string) {
		super(`no datastore under ${root} — run housing-ops setup`);
		this.name = "StoreNotInitializedError";
	}
}
