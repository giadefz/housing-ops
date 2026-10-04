import { AppError } from "./app-error.js";

/** Thrown when a status move is illegal. */
export class InvalidTransitionError extends AppError {
	constructor(status: string, action: string) {
		super(`illegal transition from ${status} in ${action}`);
		this.name = "InvalidTransitionError";
	}
}

/** Thrown when an offer is requested but not stored. */
export class OfferNotFoundError extends AppError {
	constructor(id: string) {
		super(`offer not found: ${id}`);
		this.name = "OfferNotFoundError";
	}
}
