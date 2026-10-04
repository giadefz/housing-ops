import { AppError } from "./app-error.js";

/** Thrown when a listing fails the interchange. */
export class InvalidListingError extends AppError {
	constructor(reason: string) {
		super(`invalid listing: ${reason}`);
		this.name = "InvalidListingError";
	}
}
