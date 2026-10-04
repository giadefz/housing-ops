/** Parsed command flags keyed by name: --key value, --key=value, or --flag. */
export interface Flags {
	[flag: string]: string | boolean;
}

/** Raw argv split into command, flags, and trailing positionals. */
export interface ParsedArgs {
	command: string | null;
	flags: Flags;
	rest: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
	const tokens = attachOptionValues(argv.slice(2));
	return {
		command: readCommand(tokens),
		flags: readFlags(tokens),
		rest: readRest(tokens),
	};
}

function attachOptionValues(tokens: string[]): string[] {
	const attached: string[] = [];
	for (const token of tokens) appendToken(attached, token);
	return attached;
}

function appendToken(attached: string[], token: string): void {
	const previous = attached[attached.length - 1];
	if (isBareOption(previous) && !isOption(token)) {
		attached[attached.length - 1] = `${previous}=${token}`;
		return;
	}
	attached.push(token);
}

function isOption(token: string | undefined): token is string {
	return token !== undefined && token.startsWith("--");
}

function isBareOption(token: string | undefined): boolean {
	return isOption(token) && !token.includes("=");
}

function readCommand(tokens: string[]): string | null {
	return tokens.find((token) => !isOption(token)) ?? null;
}

function readFlags(tokens: string[]): Flags {
	return Object.fromEntries(tokens.filter(isOption).map(splitOption));
}

function splitOption(token: string): [string, string | boolean] {
	const equals = token.indexOf("=");
	if (equals === -1) return [token.slice(2), true];
	return [token.slice(2, equals), token.slice(equals + 1)];
}

function readRest(tokens: string[]): string[] {
	return tokens.filter((token) => !isOption(token)).slice(1);
}
