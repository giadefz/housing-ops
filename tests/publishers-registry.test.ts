import { describe, expect, it } from "vitest";
import { parsePublishers } from "../src/adapters/secondary/publishers/registry.js";

describe("parsePublishers", () => {
	it("returns no publishers when the file is absent", () => {
		expect(parsePublishers(null)).toEqual([]);
	});
	it("parses entries with defaults", () => {
		const text = [
			"version: 1",
			"publishers:",
			"  - id: fast",
			"    type: process",
			"    events: [offer.passed]",
			"    command: python",
			"    args: [publish.py]",
		].join("\n");
		const [entry] = parsePublishers(text);
		expect(entry).toMatchObject({
			id: "fast",
			type: "process",
			enabled: true,
			events: ["offer.passed"],
			command: "python",
			args: ["publish.py"],
		});
	});
	it("throws on an invalid file", () => {
		expect(() =>
			parsePublishers("version: 1\npublishers:\n  - id: x\n"),
		).toThrow(/publishers.yml/);
	});
});
