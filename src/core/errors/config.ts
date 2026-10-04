import { AppError, causeOptions } from "./app-error.js";

/** Thrown when a config file is present but cannot be parsed or validated. */
export class ConfigError extends AppError {
	constructor(reason: string, cause?: unknown) {
		super(`invalid config: ${reason}`, causeOptions(cause));
		this.name = "ConfigError";
	}
}
