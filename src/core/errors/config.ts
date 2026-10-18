import { AppError, causeOptions } from "./app-error.js";

/** Thrown when a config file is present but cannot be parsed or validated. */
export class ConfigError extends AppError {
	constructor(reason: string, cause?: unknown) {
		super(`invalid config: ${reason}`, causeOptions(cause));
		this.name = "ConfigError";
	}
}

/** Thrown when the store has no shared config yet. */
export class ConfigNotFoundError extends AppError {
	constructor() {
		super("config not initialized — run housing-ops init");
		this.name = "ConfigNotFoundError";
	}
}
