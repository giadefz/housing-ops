import { AppError } from "./app-error.js";

/** Thrown when a status move is illegal. */
export class InvalidTransitionError extends AppError {
	constructor(status: string, action: string) {
		super(`illegal transition from ${status} in ${action}`);
		this.name = "InvalidTransitionError";
	}
}

/** Thrown when a verdict is not allowed for its tier. */
export class InvalidVerdictError extends AppError {
	constructor(tier: string, verdict: string) {
		super(`verdict "${verdict}" is not valid for tier "${tier}"`);
		this.name = "InvalidVerdictError";
	}
}

/** Thrown when a queue status filter is not a known offer status. */
export class UnknownStatusError extends AppError {
	constructor(status: string) {
		super(`unknown offer status: ${status}`);
		this.name = "UnknownStatusError";
	}
}

/** Thrown when a judgment tier is not `triage` or `analyse`. */
export class UnknownTierError extends AppError {
	constructor(tier: string) {
		super(`unknown judgment tier: ${tier}`);
		this.name = "UnknownTierError";
	}
}

/** Thrown when a user action is not a known interaction action. */
export class UnknownActionError extends AppError {
	constructor(action: string) {
		super(`unknown interaction action: ${action}`);
		this.name = "UnknownActionError";
	}
}

/** Thrown when an offer is requested but not stored. */
export class OfferNotFoundError extends AppError {
	constructor(id: string) {
		super(`offer not found: ${id}`);
		this.name = "OfferNotFoundError";
	}
}
