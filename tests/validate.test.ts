import { describe, expect, it } from "vitest";
import {
	validateWorkspace,
	type WorkspaceInput,
} from "../src/core/services/validate.service.js";

function emptyInput(): WorkspaceInput {
	return {
		configTexts: {
			"profile.yml": null,
			"pipeline.yml": null,
			"providers.yml": null,
			"extensions.yml": null,
		},
		currentHashes: {},
		databaseExists: false,
	};
}

function inputWithExtensions(
	extensionsText: string,
	currentHashes: Record<string, string | null>,
): WorkspaceInput {
	const input = emptyInput();
	input.configTexts["extensions.yml"] = extensionsText;
	input.currentHashes = currentHashes;
	return input;
}

describe("validate on empty workspace", () => {
	it("fails every config check gracefully without throwing", () => {
		const report = validateWorkspace(emptyInput());
		const byName = Object.fromEntries(
			report.findings.map((finding) => [finding.name, finding]),
		);
		for (const file of [
			"profile.yml",
			"pipeline.yml",
			"providers.yml",
			"extensions.yml",
		]) {
			expect(byName[`config.${file}`].ok).toBe(false);
			expect(byName[`config.${file}`].detail).toMatch(/setup/);
		}
		expect(byName["db"].ok).toBe(false);
		expect(byName["api"].ok).toBe(true);
	});
	it("passes a present valid config file", () => {
		const input = emptyInput();
		input.configTexts["profile.yml"] = "version: 1\n";
		const report = validateWorkspace(input);
		const finding = report.findings.find(
			(candidate) => candidate.name === "config.profile.yml",
		);
		expect(finding?.ok).toBe(true);
	});
	it("fails an invalid config file with the reason", () => {
		const input = emptyInput();
		input.configTexts["profile.yml"] = "version: 2\n";
		const report = validateWorkspace(input);
		const finding = report.findings.find(
			(candidate) => candidate.name === "config.profile.yml",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/invalid/);
	});
	it("fails an unparseable config file with the reason", () => {
		const input = emptyInput();
		input.configTexts["profile.yml"] = "version: [unclosed\n";
		const report = validateWorkspace(input);
		const finding = report.findings.find(
			(candidate) => candidate.name === "config.profile.yml",
		);
		expect(finding?.ok).toBe(false);
		expect(finding?.detail).toMatch(/invalid/);
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
