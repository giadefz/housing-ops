/** Base class for every error the application raises. The wire layer maps these to failure envelopes. */
export abstract class AppError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
	}
}

/** Builds Error options from an optional cause, so wrapping keeps the original error. */
export function causeOptions(cause: unknown): ErrorOptions | undefined {
	return cause === undefined ? undefined : { cause };
}
