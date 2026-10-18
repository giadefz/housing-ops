import type { ApplicationPort } from "../../../core/ports/application.port.js";
import { parseArgs, type ParsedArgs } from "./argv.js";
import { fail, type Envelope } from "./envelope.js";
import { toFailure } from "./failures.js";
import { help } from "./commands/help.js";
import { feedCommands } from "./commands/feed.js";
import { filterCommands } from "./commands/filter.js";
import { interactCommands } from "./commands/interact.js";
import { offerCommands } from "./commands/offer.js";
import { profileCommands } from "./commands/profile.js";
import { providerCommands } from "./commands/provider.js";
import { publishCommands } from "./commands/publish.js";
import { queueCommands } from "./commands/queue.js";
import { scanCommands } from "./commands/scan.js";
import { initCommands } from "./commands/init.js";
import { configCommands } from "./commands/config.js";
import { systemCommands } from "./commands/system.js";
import { verdictCommands } from "./commands/verdict.js";
import type { CommandHandler } from "./commands/types.js";

const commandHandlers: Record<string, CommandHandler> = {
	...systemCommands,
	...initCommands,
	...configCommands,
	...offerCommands,
	...providerCommands,
	...filterCommands,
	...queueCommands,
	...feedCommands,
	...verdictCommands,
	...interactCommands,
	...profileCommands,
	...publishCommands,
	...scanCommands,
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
		logError(error);
		finish(fail(toFailure(error)));
	}
}

/** Writes the full error, and its cause chain, to stderr. stdout stays machine-readable. */
function logError(error: unknown): void {
	process.stderr.write(`housing-ops: ${describeError(error)}\n`);
}

function describeError(error: unknown): string {
	const parts: string[] = [];
	let current: unknown = error;
	while (current !== undefined && current !== null) {
		parts.push(describeOne(current));
		current = current instanceof Error ? current.cause : undefined;
	}
	return parts.join("\ncaused by: ");
}

function describeOne(error: unknown): string {
	if (error instanceof Error)
		return error.stack ?? `${error.name}: ${error.message}`;
	return String(error);
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

function unknownCommand(command: string): {
	code: string;
	message: string;
	hint: string;
} {
	return {
		code: "UNKNOWN_COMMAND",
		message: `unknown command: ${command}`,
		hint: "run housing-ops help for the command list",
	};
}
