import { describe, expect, it } from "vitest";
import { createProcessAdapter } from "../src/adapters/secondary/providers/process-adapter.js";
import { testProvider } from "../src/core/services/provider.service.js";

function record(id: string): string {
	return JSON.stringify({
		listing_id: id,
		url: `https://example.invalid/${id}`,
		market: "rent",
		price: { amount: 1, currency: "EUR", period: "month" },
		address_text: "a",
	});
}

function fakeProvider(payload: string) {
	return createProcessAdapter({
		id: "fake",
		type: "process",
		country: "ie",
		markets: ["rent"],
		command: process.execPath,
		args: ["-e", "process.stdout.write(process.env.PAYLOAD ?? '')"],
		env: { PAYLOAD: payload },
		output: "jsonl",
	});
}

describe("testProvider", () => {
	it("fetches at most the cap and returns the sample", async () => {
		const payload = `${record("a")}\n${record("b")}\n${record("c")}\n`;
		const result = await testProvider({
			provider: fakeProvider(payload),
			cap: 2,
		});
		expect(result.fetched).toBe(2);
		expect(result.sample.map((listing) => listing.listing_id)).toEqual([
			"a",
			"b",
		]);
	});
	it("propagates provider errors", async () => {
		const provider = createProcessAdapter({
			id: "bad",
			type: "process",
			country: "ie",
			markets: ["rent"],
			command: process.execPath,
			args: ["-e", "process.exit(1)"],
			output: "jsonl",
		});
		await expect(testProvider({ provider, cap: 5 })).rejects.toThrow();
	});
});
