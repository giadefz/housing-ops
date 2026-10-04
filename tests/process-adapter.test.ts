import { describe, expect, it } from "vitest";
import {
	createProcessAdapter,
	parseRecords,
} from "../src/adapters/secondary/providers/process-adapter.js";
import { ProviderError } from "../src/core/errors/provider.js";
import type { FetchContext } from "../src/core/ports/provider.port.js";

const first = { listing_id: "a1", url: "https://example.invalid/a1" };
const second = { listing_id: "a2", url: "https://example.invalid/a2" };

function context(): FetchContext {
	return {
		signal: new AbortController().signal,
		pace: async () => {},
		log: () => {},
	};
}

async function collect(iterable: AsyncIterable<unknown>): Promise<unknown[]> {
	const records: unknown[] = [];
	for await (const record of iterable) records.push(record);
	return records;
}

function emitProcess(payload: string, output: "jsonl" | "json" = "jsonl") {
	return {
		id: "fake",
		type: "process",
		country: "ie",
		markets: ["rent"],
		command: process.execPath,
		args: ["-e", "process.stdout.write(process.env.PAYLOAD ?? '')"],
		env: { PAYLOAD: payload },
		output,
	};
}

describe("parseRecords", () => {
	it("parses one record per JSONL line, skipping blanks", () => {
		const text = `${JSON.stringify(first)}\n\n${JSON.stringify(second)}\n`;
		expect(parseRecords(text, "jsonl", "fake")).toEqual([first, second]);
	});
	it("parses a JSON array", () => {
		expect(
			parseRecords(JSON.stringify([first, second]), "json", "fake"),
		).toHaveLength(2);
	});
	it("rejects invalid JSON", () => {
		expect(() => parseRecords("{not json", "jsonl", "fake")).toThrow(
			ProviderError,
		);
	});
});

describe("createProcessAdapter", () => {
	it("yields the records a process prints", async () => {
		const provider = createProcessAdapter(
			emitProcess(`${JSON.stringify(first)}\n`),
		);
		const records = await collect(provider.fetch({}, context()));
		expect(records).toEqual([first]);
		expect(provider.id).toBe("fake");
	});
	it("fails when the process exits non-zero, including stderr", async () => {
		const provider = createProcessAdapter({
			id: "broken",
			type: "process",
			country: "ie",
			markets: ["rent"],
			command: process.execPath,
			args: ["-e", "process.stderr.write('kaboom'); process.exit(3)"],
			output: "jsonl",
		});
		await expect(collect(provider.fetch({}, context()))).rejects.toThrow(
			/kaboom/,
		);
	});
	it("fails when the process exceeds its timeout", async () => {
		const provider = createProcessAdapter({
			id: "slow",
			type: "process",
			country: "ie",
			markets: ["rent"],
			command: process.execPath,
			args: ["-e", "setTimeout(() => {}, 10000)"],
			output: "jsonl",
			timeoutMs: 200,
		});
		await expect(
			collect(provider.fetch({}, context())),
		).rejects.toBeInstanceOf(ProviderError);
	});
	it("rejects an invalid provider config", () => {
		expect(() => createProcessAdapter({ id: "x" })).toThrow();
	});
});
