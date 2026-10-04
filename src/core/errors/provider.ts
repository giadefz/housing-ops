import { AppError, causeOptions } from "./app-error.js";

/** Thrown when a provider cannot fetch or emits invalid interchange. */
export class ProviderError extends AppError {
	constructor(provider: string, reason: string, cause?: unknown) {
		super(`provider ${provider}: ${reason}`, causeOptions(cause));
		this.name = "ProviderError";
	}
}

/** Thrown when a provider id is requested but not configured. */
export class ProviderNotFoundError extends AppError {
	constructor(id: string) {
		super(`provider not found: ${id}`);
		this.name = "ProviderNotFoundError";
	}
}
