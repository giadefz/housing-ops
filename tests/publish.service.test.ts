import { describe, expect, it } from "vitest";
import type { PipelineEvent } from "../src/core/domain/events.js";
import type { PublisherPort } from "../src/core/ports/publisher.port.js";
import { deliver } from "../src/core/services/publish.service.js";

function publisher(
	id: string,
	subscriptions: PipelineEvent[],
	fail = false,
): PublisherPort {
	return {
		id,
		subscriptions,
		async publish() {
			if (fail) throw new Error("boom");
		},
	};
}

describe("deliver", () => {
	it("delivers only to subscribers", async () => {
		const outcomes = await deliver(
			[
				publisher("a", ["offer.passed"]),
				publisher("b", ["offer.screened"]),
			],
			"offer.passed",
			{},
		);
		expect(outcomes).toEqual([
			{ publisher: "a", event: "offer.passed", ok: true },
		]);
	});

	it("is best-effort: a failure is reported, not thrown", async () => {
		const outcomes = await deliver(
			[
				publisher("a", ["offer.passed"], true),
				publisher("b", ["offer.passed"]),
			],
			"offer.passed",
			{},
		);
		expect(outcomes[0]).toMatchObject({ publisher: "a", ok: false });
		expect(outcomes[1]).toMatchObject({ publisher: "b", ok: true });
	});
});
