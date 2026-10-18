import { describe, expect, it } from "vitest";
import { toFailure } from "../src/adapters/primary/cli/failures.js";
import { InterfaceDisabledError } from "../src/core/errors/instance.js";
import { OfferNotFoundError } from "../src/core/errors/offer.js";
import { ProviderError } from "../src/core/errors/provider.js";

describe("toFailure", () => {
	it("maps a known error to its code and hint", () => {
		expect(toFailure(new OfferNotFoundError("x"))).toEqual({
			code: "OFFER_NOT_FOUND",
			message: "offer not found: x",
			hint: "run housing-ops queue to list offers",
		});
	});
	it("maps a known provider error", () => {
		expect(toFailure(new ProviderError("daft", "boom")).code).toBe(
			"PROVIDER_ERROR",
		);
	});
	it("maps a disabled interface", () => {
		expect(toFailure(new InterfaceDisabledError("cli"))).toMatchObject({
			code: "INTERFACE_DISABLED",
		});
	});
	it("maps an unknown error to INTERNAL_ERROR", () => {
		const failure = toFailure(new Error("boom"));
		expect(failure.code).toBe("INTERNAL_ERROR");
		expect(failure.message).toBe("boom");
	});
});
