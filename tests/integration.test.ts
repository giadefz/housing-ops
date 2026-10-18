import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { findDecision } from "../src/adapters/secondary/storage/sqlite/decision.js";
import { findOfferByListing } from "../src/adapters/secondary/storage/sqlite/offer.js";
import {
	closeStore,
	openStore,
} from "../src/adapters/secondary/storage/sqlite/store.js";
import { DEFAULT_MEMBER_ID } from "../src/core/domain/member.js";
import { createDefaultApplication } from "../src/defaults.js";

let roots: string[] = [];
afterEach(() => {
	for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
	roots = [];
});

const MEMBER = DEFAULT_MEMBER_ID;

async function marketStatus(
	database: Database.Database,
	listingId: string,
): Promise<string | undefined> {
	const offer = await findOfferByListing(database, "fake", listingId);
	if (offer === null) return undefined;
	return (await findDecision(database, MEMBER, offer.id))?.marketStatus;
}

const profileYaml = [
	"version: 1",
	"market: rent",
	"country: ie",
	"budget:",
	"  max: 2200",
	"  currency: EUR",
	'areas: ["Dublin 8"]',
	"gate: false",
	"",
].join("\n");

const pipelineYaml = [
	"version: 1",
	"filters:",
	"  - id: budget",
	"    enabled: true",
	"    missing: fail",
	"",
].join("\n");

const listings = JSON.stringify([
	{
		listing_id: "cheap",
		url: "https://example.invalid/cheap",
		market: "rent",
		price: { amount: 2000, currency: "EUR", period: "month" },
		address_text: "1 Main Street, Dublin 8",
		extra: { ber: "B", eircode: "D08X1" },
	},
	{
		listing_id: "pricey",
		url: "https://example.invalid/pricey",
		market: "rent",
		price: { amount: 3000, currency: "EUR", period: "month" },
		address_text: "2 Main Street, Dublin 8",
		extra: { ber: "B", eircode: "D08X2" },
	},
	{ listing_id: "bad" },
]);

const providersYaml = [
	"version: 1",
	"providers:",
	"  - id: fake",
	"    type: process",
	"    country: ie",
	"    markets: [rent]",
	"    command: node",
	'    args: ["-e", "process.stdout.write(process.env.PAYLOAD ?? \'\')"]',
	"    env:",
	`      PAYLOAD: '${listings}'`,
	"    output: json",
	"",
].join("\n");

interface Workspace {
	root: string;
	database: Database.Database;
}

function workspace(): Workspace {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	roots.push(root);
	fs.mkdirSync(path.join(root, "config"), { recursive: true });
	fs.mkdirSync(path.join(root, "data"), { recursive: true });
	const database = openStore(path.join(root, "data", "housing.db"));
	closeStore(database);
	writeConfig(root, "profile.yml", profileYaml);
	writeConfig(root, "pipeline.yml", pipelineYaml);
	writeConfig(root, "providers.yml", providersYaml);
	writeConfig(root, "publishers.yml", "version: 1\n");
	writeConfig(root, "extensions.yml", "version: 1\n");
	return { root, database: openStore(path.join(root, "data", "housing.db")) };
}

function writeConfig(root: string, file: string, content: string): void {
	fs.writeFileSync(path.join(root, "config", file), content);
}

describe("end to end", () => {
	it("validates, scans a process provider, filters, stores, and reads back", async () => {
		const { root, database } = workspace();
		try {
			const app = await createDefaultApplication(root);

			const report = app.validateWorkspace();
			expect(report.findings.every((finding) => finding.ok)).toBe(true);

			expect(app.listProviders().map((provider) => provider.id)).toEqual([
				"fake",
			]);
			expect(app.listFilters()).toEqual([
				{
					id: "budget",
					enabled: true,
					missing: "fail",
					available: true,
				},
			]);

			const scan = await app.scan({ memberId: MEMBER });
			expect(scan).toEqual({ fetched: 3, stored: 2, deadLettered: 1 });

			expect(await marketStatus(database, "cheap")).toBe("passed");
			expect(await marketStatus(database, "pricey")).toBe("seen");

			const dead: unknown[] = database
				.prepare("SELECT * FROM dead_letter")
				.all();
			expect(dead).toHaveLength(1);
			const verdicts: unknown[] = database
				.prepare(
					"SELECT filter_id, outcome FROM verdicts ORDER BY outcome",
				)
				.all();
			expect(verdicts).toEqual([
				{ filter_id: "budget", outcome: "fail" },
				{ filter_id: "budget", outcome: "pass" },
			]);

			expect(await app.checkFilter("budget")).toMatchObject({
				evaluated: 2,
				pass: 1,
				fail: 1,
				skip: 0,
			});
		} finally {
			closeStore(database);
		}
	});
});
