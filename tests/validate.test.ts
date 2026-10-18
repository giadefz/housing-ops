import { describe, expect, it } from "vitest";
import type { Config } from "../src/core/schemas/config.js";
import type { Profile } from "../src/core/schemas/profile.js";
import {
	validateWorkspace,
	type WorkspaceInput,
} from "../src/core/services/validate.service.js";

const instanceText = [
	"version: 1",
	"name: Home",
	"country: ie",
	"market: rent",
	"",
].join("\n");

function emptyInput(): WorkspaceInput {
	return {
		instanceText: null,
		config: null,
		profile: null,
		extensionsText: null,
		currentHashes: {},
		store: { location: "data/housing.db", schemaVersion: null },
		expectedSchemaVersion: 1,
	};
}

function configFixture(): Config {
	return {
		pipeline: {
			version: 1,
			filters: [{ id: "budget", enabled: true, missing: "skip" }],
		},
		providers: { version: 1, providers: [] },
		publishers: { version: 1, publishers: [] },
	};
}

function profileFixture(): Profile {
	return {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: true,
		recheckHours: 48,
	};
}

function inputWithExtensions(
	extensionsText: string,
	currentHashes: Record<string, string | null>,
): WorkspaceInput {
	const input = emptyInput();
	input.extensionsText = extensionsText;
	input.currentHashes = currentHashes;
	return input;
}

describe("validate on empty workspace", () => {
	it("fails instance, config, and profile checks with an init hint", () => {
		const report = validateWorkspace(emptyInput());
		const byName = Object.fromEntries(
			report.findings.map((finding) => [finding.name, finding]),
		);
		for (const name of ["config.instance", "config.store", "profile"]) {
			expect(byName[name]?.ok).toBe(false);
			expect(byName[name]?.detail).toMatch(/init/);
		}
		expect(byName["db"]?.ok).toBe(false);
		expect(byName["api"]?.ok).toBe(true);
	});

	it("passes a valid instance file", () => {
		const input = emptyInput();
		input.instanceText = instanceText;
		const finding = validateWorkspace(input).findings.find(
			(candidate) => candidate.name === "config.instance",
		);
		expect(finding?.ok).toBe(true);
	});

	it("fails an invalid instance file with the reason", () => {
		const input = emptyInput();
		input.instanceText = "version: 2\n";
		const finding = validateWorkspace(input).findings.find(
			(candidate) => candidate.name === "config.instance",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/invalid/);
	});

	it("passes a present store config", () => {
		const input = emptyInput();
		input.config = configFixture();
		const finding = validateWorkspace(input).findings.find(
			(candidate) => candidate.name === "config.store",
		);
		expect(finding?.ok).toBe(true);
	});

	it("passes a present admin profile", () => {
		const input = emptyInput();
		input.profile = profileFixture();
		const finding = validateWorkspace(input).findings.find(
			(candidate) => candidate.name === "profile",
		);
		expect(finding?.ok).toBe(true);
	});

	it("flags an identity mismatch between the instance and profile", () => {
		const input = emptyInput();
		input.instanceText = instanceText;
		input.profile = { ...profileFixture(), country: "fr" };
		const finding = validateWorkspace(input).findings.find(
			(candidate) => candidate.name === "identity",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/country/);
	});

	it("flags a market mismatch between the instance and profile", () => {
		const input = emptyInput();
		input.instanceText = instanceText.replace(
			"market: rent",
			"market: buy",
		);
		input.profile = profileFixture();
		const finding = validateWorkspace(input).findings.find(
			(candidate) => candidate.name === "identity",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/market/);
	});

	it("reports a corrupt store config", () => {
		const input = emptyInput();
		input.configError = "bad json";
		const finding = validateWorkspace(input).findings.find(
			(candidate) => candidate.name === "config.store",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/corrupt/);
	});

	it("reports a corrupt admin profile", () => {
		const input = emptyInput();
		input.profileError = "bad json";
		const finding = validateWorkspace(input).findings.find(
			(candidate) => candidate.name === "profile",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/corrupt/);
	});
});

describe("validate extension pins", () => {
	const extensionsText =
		"version: 1\napprovals:\n  - id: garden\n    kind: filter\n    path: filters.local/garden.ts\n    sha256: abc123\n    approved_at: 2026-10-04\n";
	it("passes a matching approval", () => {
		const report = validateWorkspace(
			inputWithExtensions(extensionsText, {
				"filters.local/garden.ts": "abc123",
			}),
		);
		const finding = report.findings.find(
			(candidate) => candidate.name === "extension.garden",
		);
		expect(finding?.ok).toBe(true);
	});
	it("fails a changed file until re-approved", () => {
		const report = validateWorkspace(
			inputWithExtensions(extensionsText, {
				"filters.local/garden.ts": "deadbeef",
			}),
		);
		const finding = report.findings.find(
			(candidate) => candidate.name === "extension.garden",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/changed since approval/);
	});
	it("fails a missing approved file", () => {
		const report = validateWorkspace(
			inputWithExtensions(extensionsText, {}),
		);
		const finding = report.findings.find(
			(candidate) => candidate.name === "extension.garden",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/missing/);
	});
	it("fails a malformed approval entry", () => {
		const malformed = "version: 1\napprovals:\n  - id: garden\n";
		const report = validateWorkspace(inputWithExtensions(malformed, {}));
		const finding = report.findings.find(
			(candidate) => candidate.name === "extension[0]",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/invalid approval/);
	});
	it("fails loudly when extensions.yml itself is broken", () => {
		const report = validateWorkspace(
			inputWithExtensions("version: [unclosed\n", {}),
		);
		const finding = report.findings.find(
			(candidate) => candidate.name === "extensions",
		);
		expect(finding?.ok).toBe(false);
	});
});

describe("schema version", () => {
	function schemaFinding(input: WorkspaceInput): {
		ok: boolean;
		detail?: string;
	} {
		const finding = validateWorkspace(input).findings.find(
			(candidate) => candidate.name === "schema",
		);
		if (finding === undefined) throw new Error("no schema finding");
		return finding;
	}

	it("passes when there is no database yet", () => {
		expect(schemaFinding(emptyInput()).ok).toBe(true);
	});
	it("passes when the database schema matches the core", () => {
		const input = emptyInput();
		input.store.schemaVersion = 1;
		expect(schemaFinding(input).ok).toBe(true);
	});
	it("fails when the database schema is behind", () => {
		const input = emptyInput();
		input.store.schemaVersion = 0;
		const finding = schemaFinding(input);
		expect(finding.ok).toBe(false);
		expect(finding.detail).toMatch(/migrate/);
	});
	it("fails when the database schema is ahead", () => {
		const input = emptyInput();
		input.store.schemaVersion = 2;
		const finding = schemaFinding(input);
		expect(finding.ok).toBe(false);
		expect(finding.detail).toMatch(/update housing-ops/);
	});
});
