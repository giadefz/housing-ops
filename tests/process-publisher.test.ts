import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProcessPublisher } from "../src/adapters/secondary/publishers/process-publisher.js";
import type { FeedEntry } from "../src/core/domain/feed.js";
import type { Offer } from "../src/core/domain/offer.js";
import type { PublisherEntry } from "../src/core/schemas/index.js";

let cleanups: Array<() => void> = [];
afterEach(() => {
	for (const cleanup of cleanups) cleanup();
	cleanups = [];
});

function tmpFile(): string {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	cleanups.push(() => fs.rmSync(directory, { recursive: true, force: true }));
	return path.join(directory, "stdin.json");
}

function offerFixture(): Offer {
	return {
		id: "o1",
		dwellingId: "dw-1",
		provider: "daft",
		listingId: "abc",
		url: "https://example.invalid/abc",
		market: "rent",
		price: { amount: 2200, currency: "EUR", period: "month" },
		images: [],
		description: "Bright apartment",
		fetchedAt: "2026-10-04T00:00:00.000Z",
		versions: [],
	};
}

function feedFixture(): FeedEntry {
	return {
		memberId: "local",
		offerId: "o1",
		addedAt: "2026-10-04T00:00:00.000Z",
		state: "to-evaluate",
	};
}

const payload = { offer: offerFixture(), feed: feedFixture() };

function entry(overrides: Partial<PublisherEntry> = {}): PublisherEntry {
	return {
		id: "hook",
		type: "process",
		enabled: true,
		events: ["offer.passed"],
		command: "node",
		args: [],
		env: {},
		...overrides,
	};
}

const writeStdin =
	"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>require('fs').writeFileSync(process.env.OUT,s));";

describe("createProcessPublisher", () => {
	it("writes the event envelope to the command's stdin", async () => {
		const out = tmpFile();
		const publisher = createProcessPublisher(
			entry({ args: ["-e", writeStdin], env: { OUT: out } }),
		);
		await publisher.publish("offer.passed", payload);
		const written = JSON.parse(fs.readFileSync(out, "utf8")) as unknown;
		expect(written).toEqual({ event: "offer.passed", payload });
		expect(publisher.subscriptions).toEqual(["offer.passed"]);
	});

	it("rejects when the command exits non-zero", async () => {
		const publisher = createProcessPublisher(
			entry({ args: ["-e", "process.exit(3)"], env: {} }),
		);
		await expect(
			publisher.publish("offer.passed", payload),
		).rejects.toThrow(/code 3/);
	});
});
