import { z } from "zod";
import type { Address, LayoutType } from "../../core/domain/dwelling.js";
import type { CountryPack } from "../../core/domain/country-pack.js";

const berRatings = ["A", "B", "C", "D", "E", "F", "G"] as const;

const irishAttributes = z
	.object({
		ber: z.enum(berRatings).optional(),
		eircode: z.string().optional(),
		tenure: z.enum(["freehold", "leasehold"]).optional(),
	})
	.catchall(z.unknown());

const irishLayouts: Record<string, LayoutType> = {
	apartment: "apartment",
	flat: "apartment",
	duplex: "duplex",
	penthouse: "penthouse",
	studio: "studio",
	terrace: "terrace",
	"terraced house": "terrace",
	house: "house",
	bungalow: "house",
};

function normalizeIrishAddress(
	address: Address,
	attributes: Record<string, unknown>,
): string {
	const street = address.freeText
		.toLowerCase()
		.replace(/[^a-z0-9 ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	const eircode = attributes["eircode"];
	const code =
		typeof eircode === "string"
			? eircode.toLowerCase().replace(/\s+/g, "")
			: undefined;
	if (code === undefined || code.length === 0) return street;
	return `${street}|${code}`;
}

function mapIrishLayout(providerTerm: string): LayoutType {
	return irishLayouts[providerTerm.toLowerCase().trim()] ?? "other";
}

/** Ireland: BER ratings, Eircodes, square meters, euro. */
export const irelandPack: CountryPack = {
	code: "ie",
	attributeSchema: irishAttributes,
	defaultCurrency: "EUR",
	defaultSizeUnit: "m2",
	addressKey: normalizeIrishAddress,
	mapLayout: mapIrishLayout,
	defaultProviders: ["daft", "myhome", "rentie"],
};
