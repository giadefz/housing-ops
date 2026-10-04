import { spawn } from "node:child_process";
import { z } from "zod";
import { ListingSchema, type Listing } from "../../../core/domain/listing.js";
import { MARKETS } from "../../../core/domain/offer.js";
import { ProviderError } from "../../../core/errors.js";
import type {
	FetchContext,
	ProviderPort,
} from "../../../core/ports/provider.port.js";

/** How a command's stdout carries listings. */
export type OutputFormat = "jsonl" | "json";

export const CommandProviderSchema = z.object({
	id: z.string().min(1),
	country: z.string().min(1),
	markets: z.array(z.enum(MARKETS)).min(1),
	command: z.string().min(1),
	args: z.array(z.string()).default([]),
	env: z.record(z.string(), z.string()).default({}),
	output: z.enum(["jsonl", "json"]).default("jsonl"),
	timeoutMs: z.number().int().positive().optional(),
});

/** A provider backed by an external command emitting interchange on stdout. */
export type CommandProviderEntry = z.infer<typeof CommandProviderSchema>;

/** Runs an external command as a provider: its stdout is the listing interchange. */
export function createCommandProvider(rawEntry: unknown): ProviderPort {
	const entry = CommandProviderSchema.parse(rawEntry);
	return {
		id: entry.id,
		country: entry.country,
		markets: entry.markets,
		async *fetch(
			_config: unknown,
			context: FetchContext,
		): AsyncIterable<Listing> {
			await context.pace();
			context.log(
				`running ${entry.command} ${entry.args.join(" ")}`.trim(),
			);
			const output = await runProcess(entry, context);
			yield* parseListingOutput(output, entry.output, entry.id);
		},
	};
}

/** Parses command output into validated listings. Blank lines are skipped. */
export function parseListingOutput(
	text: string,
	output: OutputFormat,
	provider: string,
): Listing[] {
	const records =
		output === "jsonl"
			? parseJsonLines(text, provider)
			: parseJsonArray(text, provider);
	return records.map((record, index) =>
		validateListing(record, provider, index),
	);
}

function parseJsonLines(text: string, provider: string): unknown[] {
	const records: unknown[] = [];
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		records.push(parseJson(trimmed, provider));
	}
	return records;
}

function parseJsonArray(text: string, provider: string): unknown[] {
	const parsed = parseJson(text, provider);
	if (!Array.isArray(parsed))
		throw new ProviderError(provider, "expected a JSON array of listings");
	return parsed;
}

function parseJson(text: string, provider: string): unknown {
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new ProviderError(
			provider,
			`invalid JSON: ${error instanceof Error ? error.message : text}`,
		);
	}
}

function validateListing(
	record: unknown,
	provider: string,
	index: number,
): Listing {
	const parsed = ListingSchema.safeParse(record);
	if (!parsed.success) {
		throw new ProviderError(
			provider,
			`record ${index} failed interchange: ${parsed.error.message}`,
		);
	}
	return parsed.data;
}

function runProcess(
	entry: CommandProviderEntry,
	context: FetchContext,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(entry.command, entry.args, {
			env: { ...process.env, ...entry.env },
			signal: withTimeout(context.signal, entry.timeoutMs),
		});
		const stdout: Buffer[] = [];
		let stderr = "";
		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) =>
			reject(new ProviderError(entry.id, error.message)),
		);
		child.on("close", (code) => {
			if (code === 0)
				return resolve(Buffer.concat(stdout).toString("utf8"));
			reject(
				new ProviderError(
					entry.id,
					`exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
				),
			);
		});
	});
}

function withTimeout(
	signal: AbortSignal,
	timeoutMs: number | undefined,
): AbortSignal {
	if (timeoutMs === undefined) return signal;
	return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
}
