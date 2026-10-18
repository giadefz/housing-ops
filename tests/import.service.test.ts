import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/core/errors/config.js";
import {
	type ImportConfigRequest,
	buildImportInput,
} from "../src/core/services/import.service.js";

function request(): ImportConfigRequest {
	return {
		name: "Home",
		documents: {
			profile: {
				version: 1,
				market: "rent",
				country: "ie",
				budget: { max: 2200, currency: "EUR" },
				areas: ["Dublin 8"],
				gate: false,
				recheckHours: 48,
			},
			pipeline: {
				version: 1,
				filters: [{ id: "budget", enabled: true, missing: "skip" }],
			},
			providers: { version: 1, providers: [] },
			publishers: { version: 1, publishers: [] },
		},
	};
}

describe("buildImportInput", () => {
	it("builds the bootstrap input from legacy config documents", () => {
		expect(buildImportInput(request())).toEqual({
			instance: {
				version: 1,
				name: "Home",
				country: "ie",
				market: "rent",
				interfaces: ["cli"],
			},
			profile: {
				market: "rent",
				country: "ie",
				budget: { max: 2200, currency: "EUR" },
				areas: ["Dublin 8"],
				gate: false,
				recheckHours: 48,
			},
			config: {
				pipeline: {
					version: 1,
					filters: [{ id: "budget", enabled: true, missing: "skip" }],
				},
				providers: { version: 1, providers: [] },
				publishers: { version: 1, publishers: [] },
			},
		});
	});

	it("rejects a profile without a budget", () => {
		const input = request();
		input.documents.profile = {
			version: 1,
			market: "rent",
			country: "ie",
		};
		expect(() => buildImportInput(input)).toThrow(ConfigError);
	});

	it("rejects a profile without a version", () => {
		const input = request();
		input.documents.profile = {
			market: "rent",
			country: "ie",
			budget: { max: 2200, currency: "EUR" },
		};
		expect(() => buildImportInput(input)).toThrow(ConfigError);
	});

	it("rejects an invalid pipeline", () => {
		const input = request();
		input.documents.pipeline = { version: 2 };
		expect(() => buildImportInput(input)).toThrow(ConfigError);
	});

	it("rejects an empty instance name", () => {
		const input = request();
		input.name = "";
		expect(() => buildImportInput(input)).toThrow(ConfigError);
	});
});
