import { AppError } from "./app-error.js";

/** Thrown when a filter id is requested but no available filter provides it. */
export class FilterNotFoundError extends AppError {
	constructor(id: string) {
		super(`filter not found: ${id}`);
		this.name = "FilterNotFoundError";
	}
}
