import { describe, expect, it } from "vitest";
import { normalizeListing } from "../src/core/domain/listing.js";
import { irelandPack } from "../src/countries/ie/pack.js";

function rawListing(): unknown {
	return {
		listing_id: "abc",
		url: "https://example.invalid/abc",
		market: "rent",
		price: { amount: 2200, currency: "EUR", period: "month" },
		address_text: "12 Main Street, Dublin 8",
		bedrooms: 2,
		extra: {
			ber: "B",
			eircode: "D08AB12",
			city: "Dublin",
			county: "Dublin",
		},
	};
}

describe("normalizeListing", () => {
	it("splits a listing into dwelling facts and offer facts", () => {
		const { dwelling, offer } = normalizeListing({
			listing: rawListing(),
			pack: irelandPack,
			fetchedAt: "2026-10-04T00:00:00.000Z",
		});
		expect(dwelling.address.locality).toBe("Dublin");
		expect(dwelling.rooms).toEqual({ bedrooms: 2 });
		expect(dwelling.attributes).toMatchObject({ ber: "B" });
		expect(offer.listingId).toBe("abc");
		expect(offer.price.amount).toBe(2200);
		expect(offer.fetchedAt).toBe("2026-10-04T00:00:00.000Z");
	});
	it("rejects listings without an identity", () => {
		const raw = rawListing() as Record<string, unknown>;
		delete raw["listing_id"];
		expect(() =>
			normalizeListing({
				listing: raw,
				pack: irelandPack,
				fetchedAt: "now",
			}),
		).toThrow(/listing/);
	});
	it("rejects attributes the country pack does not accept", () => {
		const raw = rawListing() as { extra: Record<string, unknown> };
		raw.extra["ber"] = "Z";
		expect(() =>
			normalizeListing({
				listing: raw,
				pack: irelandPack,
				fetchedAt: "now",
			}),
		).toThrow(/attributes/);
	});
});
