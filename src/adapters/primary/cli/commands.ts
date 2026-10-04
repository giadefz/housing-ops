#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { validateWorkspace } from "../../../core/services/validate.service.js";
import { API_VERSION, getVersion } from "../../../core/version.js";
import { errorMessage } from "../../../core/errors.js";
import { readWorkspace, resolveRoot } from "../../secondary/workspace.js";
import { parseArgs } from "./argv.js";
import { fail, ok, type Envelope } from "./envelope.js";

type CommandHandler = () => void;

const commandHandlers: Record<string, CommandHandler> = {
	version: displayVersion,
	validate: displayValidationReport,
};

function main(): void {
	const { command, flags } = parseArgs(process.argv);
	if (command === null || command === "help" || flags["help"] === true) {
		displayHelp();
		return;
	}
	dispatch(command);
}

function dispatch(command: string): void {
	const handler = commandHandlers[command];
	if (handler === undefined) {
		rejectUnknownCommand(command);
		return;
	}
	try {
		handler();
	} catch (error) {
		print(fail({ code: "INTERNAL_ERROR", message: errorMessage(error) }));
		process.exitCode = 1;
	}
}

const HELP = {
	commands: [
		{ name: "version", status: "implemented" },
		{ name: "validate", status: "implemented" },
		{ name: "setup", status: "planned (Phase 7)" },
		{ name: "scan", status: "planned (Phase 2–4)" },
		{ name: "queue", status: "planned (Phase 5)" },
		{ name: "offer get", status: "planned (Phase 1)" },
		{ name: "verdict set", status: "planned (Phase 5)" },
		{ name: "interact", status: "planned (Phase 5)" },
		{ name: "prefs", status: "planned (Phase 5)" },
		{ name: "filter", status: "planned (Phase 3)" },
		{ name: "provider", status: "planned (Phase 2)" },
		{ name: "publish", status: "planned (Phase 6)" },
	],
};

function displayHelp(): void {
	print(ok({ commands: HELP.commands }));
}

function displayVersion(): void {
	print(ok(getVersion()));
}

function displayValidationReport(): void {
	print(ok(validateWorkspace(readWorkspace(resolveRoot()))));
}

function rejectUnknownCommand(command: string): void {
	print(
		fail({
			code: "UNKNOWN_COMMAND",
			message: `unknown command: ${command}`,
			hint: "run housing-ops help for the command list",
		}),
	);
	process.exitCode = 2;
}

function print(envelope: Envelope<unknown>): void {
	process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
