import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLocalFilters } from "../src/adapters/secondary/filters/local.js";

let roots: string[] = [];
afterEach(() => {
	for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
	roots = [];
});

const filterSource =
	'export default { id: "schools", evaluate: () => ({ outcome: "pass" }) };\n';

function workspaceWithFilter(): { root: string; extensions: string } {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	roots.push(root);
	const file = path.join(root, "filters.local", "schools.mjs");
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, filterSource);
	const sha256 = crypto
		.createHash("sha256")
		.update(fs.readFileSync(file))
		.digest("hex");
	const extensions = [
		"version: 1",
		"approvals:",
		"  - id: schools",
		"    kind: filter",
		"    path: filters.local/schools.mjs",
		`    sha256: ${sha256}`,
		"    approved_at: 2026-10-04",
		"",
	].join("\n");
	return { root, extensions };
}

describe("loadLocalFilters", () => {
	it("loads an approved local filter", async () => {
		const { root, extensions } = workspaceWithFilter();
		const filters = await loadLocalFilters(root, extensions);
		expect(filters.has("schools")).toBe(true);
		expect(filters.get("schools")?.evaluate({} as never)).toEqual({
			outcome: "pass",
		});
	});

	it("refuses a file whose hash changed since approval", async () => {
		const { root, extensions } = workspaceWithFilter();
		const file = path.join(root, "filters.local", "schools.mjs");
		fs.writeFileSync(file, `${filterSource}// changed\n`);
		expect((await loadLocalFilters(root, extensions)).has("schools")).toBe(
			false,
		);
	});

	it("ignores approvals that are not filters, and loads nothing without extensions", async () => {
		const { root } = workspaceWithFilter();
		expect((await loadLocalFilters(root, null)).size).toBe(0);
		const other =
			"version: 1\napprovals:\n  - id: x\n    kind: provider\n    path: x\n    sha256: y\n    approved_at: z\n";
		expect((await loadLocalFilters(root, other)).size).toBe(0);
	});
});
