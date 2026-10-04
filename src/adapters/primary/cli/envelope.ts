import { API_VERSION } from "../../../core/version.js";

/** A successful command result carrying its payload. */
export interface OkEnvelope<T> {
	ok: true;
	version: number;
	data: T;
}

/** A machine-readable failure: stable code for branching, human message, and the next step. */
export interface Failure {
	code: string;
	message: string;
	hint?: string;
}

/** A failed command result. Empty results are ok, never fail. */
export interface FailEnvelope {
	ok: false;
	version: number;
	error: Failure;
}

/** The versioned JSON contract between the core and every interface: exactly one envelope per command, printed to stdout. */
export type Envelope<T> = OkEnvelope<T> | FailEnvelope;

export function ok<T>(data: T): Envelope<T> {
	return { ok: true, version: API_VERSION, data };
}

export function fail(failure: Failure): Envelope<never> {
	return { ok: false, version: API_VERSION, error: failure };
}
