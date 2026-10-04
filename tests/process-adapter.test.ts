import { describe, expect, it } from "vitest";
import {
	createProcessAdapter,
	parseListingOutput,
} from "../src/adapters/secondary/providers/process-adapter.js";
import type { Listing } from "../src/core/domain/listing.js";
import { ProviderError } from "../src/core/errors/provider.js";
import type { FetchContext } from "../src/core/ports/provider.port.js";

const validRecord = {
	listing_id: "a1",
	url: "https://example.invalid/a1",
	market: "rent",
	price: { amount: 2000, currency: "EUR", period: "month" },
	address_text: "1 Main Street",
};

const secondRecord = {
	...validRecord,
	listing_id: "a2",
	url: "https://example.invalid/a2",
};

function context(): FetchContext {
	return {
		signal: new AbortController().signal,
		pace: async () => {},
		log: () => {},
	};
}

async function collect(iterable: AsyncIterable<Listing>): Promise<Listing[]> {
	const listings: Listing[] = [];
	for await (const listing of iterable) listings.push(listing);
	return listings;
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

describe("parseListingOutput", () => {
	it("parses one listing per JSONL line, skipping blanks", () => {
		const text = `${JSON.stringify(validRecord)}\n\n${JSON.stringify(secondRecord)}\n`;
		expect(parseListingOutput(text, "jsonl", "fake")).toEqual([
			validRecord,
			secondRecord,
		]);
	});
	it("parses a JSON array", () => {
		const text = JSON.stringify([validRecord, secondRecord]);
		expect(parseListingOutput(text, "json", "fake")).toHaveLength(2);
	});
	it("rejects invalid JSON", () => {
		expect(() => parseListingOutput("{not json", "jsonl", "fake")).toThrow(
			ProviderError,
		);
	});
	it("rejects a record that fails the interchange", () => {
		const missingUrl = JSON.stringify({ listing_id: "x", market: "rent" });
		expect(() => parseListingOutput(missingUrl, "jsonl", "fake")).toThrow(
			/interchange/,
		);
	});
	it("treats a JSON array line as one JSONL record and rejects it", () => {
		expect(() =>
			parseListingOutput(JSON.stringify([validRecord]), "jsonl", "fake"),
		).toThrow(ProviderError);
	});
});

describe("createProcessAdapter", () => {
	it("yields validated listings from a process", async () => {
		const provider = createProcessAdapter(
			emitProcess(`${JSON.stringify(validRecord)}\n`),
		);
		const listings = await collect(provider.fetch({}, context()));
		expect(listings).toEqual([validRecord]);
		expect(provider.id).toBe("fake");
		expect(provider.markets).toEqual(["rent"]);
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
