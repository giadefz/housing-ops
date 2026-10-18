import { AppError } from "./app-error.js";

/** Thrown when a dotted profile path does not resolve. */
export class ProfilePathError extends AppError {
	constructor(path: string) {
		super(`profile path not found: ${path}`);
		this.name = "ProfilePathError";
	}
}

/** Thrown when a profile write would produce an invalid profile. */
export class InvalidProfileValueError extends AppError {
	constructor(detail: string) {
		super(`invalid profile value: ${detail}`);
		this.name = "InvalidProfileValueError";
	}
}

/** Thrown when a member has no profile yet. */
export class ProfileNotFoundError extends AppError {
	constructor(memberId: string) {
		super(
			`profile not initialized for member ${memberId} — run housing-ops init`,
		);
		this.name = "ProfileNotFoundError";
	}
}
