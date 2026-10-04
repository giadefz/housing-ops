import { describe, expect, it } from "vitest";
import {
	createCommandProvider,
	parseListingOutput,
} from "../src/adapters/secondary/providers/command-provider.js";
import type { Listing } from "../src/core/domain/listing.js";
import { ProviderError } from "../src/core/errors.js";
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

function emitCommand(payload: string, output: "jsonl" | "json" = "jsonl") {
	return {
		id: "fake",
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

describe("createCommandProvider", () => {
	it("yields validated listings from a command", async () => {
		const provider = createCommandProvider(
			emitCommand(`${JSON.stringify(validRecord)}\n`),
		);
		const listings = await collect(provider.fetch({}, context()));
		expect(listings).toEqual([validRecord]);
		expect(provider.id).toBe("fake");
		expect(provider.markets).toEqual(["rent"]);
	});
	it("fails when the command exits non-zero, including stderr", async () => {
		const provider = createCommandProvider({
			id: "broken",
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
	it("fails when the command exceeds its timeout", async () => {
		const provider = createCommandProvider({
			id: "slow",
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
		expect(() => createCommandProvider({ id: "x" })).toThrow();
	});
});
