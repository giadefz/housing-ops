import { spawn } from "node:child_process";
import { errorMessage } from "../../../core/errors/message.js";
import { ProviderError } from "../../../core/errors/provider.js";
import { ListingSchema, type Listing } from "../../../core/domain/listing.js";
import {
	ProviderEntrySchema,
	type ProviderEntry,
} from "../../../core/schemas/index.js";
import type {
	FetchContext,
	ProviderPort,
} from "../../../core/ports/provider.port.js";

/** How a process's stdout carries listings. */
export type OutputFormat = "jsonl" | "json";

/** Runs an external process as a provider: its stdout is the listing interchange. */
export function createProcessAdapter(rawEntry: unknown): ProviderPort {
	const entry: ProviderEntry = ProviderEntrySchema.parse(rawEntry);
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

/** Parses process output into validated listings. Blank lines are skipped. */
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
			`invalid JSON: ${errorMessage(error)}`,
			error,
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
			parsed.error,
		);
	}
	return parsed.data;
}

function runProcess(
	entry: ProviderEntry,
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
			reject(new ProviderError(entry.id, error.message, error)),
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
