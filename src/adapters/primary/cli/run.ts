import { OfferNotFoundError } from "../../../core/domain/offer.js";
import {
	errorMessage,
	StoreNotInitializedError,
} from "../../../core/errors.js";
import type { ApplicationPort } from "../../../core/ports/application.port.js";
import { parseArgs, type ParsedArgs } from "./argv.js";
import { fail, type Envelope, type Failure } from "./envelope.js";
import { help } from "./commands/help.js";
import { offerCommands } from "./commands/offer.js";
import { systemCommands } from "./commands/system.js";
import type { CommandHandler } from "./commands/types.js";

const commandHandlers: Record<string, CommandHandler> = {
	...systemCommands,
	...offerCommands,
};

/** Drives the application for one CLI invocation: parse, dispatch, print, set the exit code. */
export async function runCli(
	app: ApplicationPort,
	argv: string[],
): Promise<void> {
	const args = parseArgs(argv);
	if (
		args.command === null ||
		args.command === "help" ||
		args.flags["help"] === true
	) {
		finish(help());
		return;
	}
	await dispatch(app, args);
}

async function dispatch(app: ApplicationPort, args: ParsedArgs): Promise<void> {
	const handler = commandHandlers[args.command ?? ""];
	if (handler === undefined) {
		finish(fail(unknownCommand(args.command ?? "")));
		return;
	}
	try {
		finish(await handler(app, args));
	} catch (error) {
		finish(fail(toFailure(error)));
	}
}

function finish(envelope: Envelope<unknown>): void {
	process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
	process.exitCode = exitCodeFor(envelope);
}

function exitCodeFor(envelope: Envelope<unknown>): number {
	if (envelope.ok) return 0;
	if (
		envelope.error.code === "USAGE" ||
		envelope.error.code === "UNKNOWN_COMMAND"
	)
		return 2;
	return 1;
}

function unknownCommand(command: string): Failure {
	return {
		code: "UNKNOWN_COMMAND",
		message: `unknown command: ${command}`,
		hint: "run housing-ops help for the command list",
	};
}

function toFailure(error: unknown): Failure {
	if (error instanceof OfferNotFoundError) {
		return {
			code: "OFFER_NOT_FOUND",
			message: error.message,
			hint: "run housing-ops queue to list offers",
		};
	}
	if (error instanceof StoreNotInitializedError) {
		return {
			code: "WORKSPACE_NOT_INITIALIZED",
			message: error.message,
			hint: "run housing-ops setup",
		};
	}
	return { code: "INTERNAL_ERROR", message: errorMessage(error) };
}
