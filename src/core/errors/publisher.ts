import { AppError, causeOptions } from "./app-error.js";

/** Thrown when a publisher command fails to deliver an event. */
export class PublisherError extends AppError {
	constructor(publisher: string, reason: string, cause?: unknown) {
		super(`publisher ${publisher}: ${reason}`, causeOptions(cause));
		this.name = "PublisherError";
	}
}
