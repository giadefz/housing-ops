import type { ApplicationPort } from "../../../../core/ports/application.port.js";
import type { ParsedArgs } from "../argv.js";
import type { Envelope } from "../envelope.js";

/** A primary-adapter command: drive one use case, return the wire envelope. */
export type CommandHandler = (
	app: ApplicationPort,
	args: ParsedArgs,
) => Promise<Envelope<unknown>> | Envelope<unknown>;
