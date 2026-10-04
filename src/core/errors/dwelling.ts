import { AppError } from "./app-error.js";

/** Thrown when dwelling facts are invalid. */
export class InvalidDwellingError extends AppError {
	constructor(reason: string) {
		super(`invalid dwelling: ${reason}`);
		this.name = "InvalidDwellingError";
	}
}
