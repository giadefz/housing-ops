import { z } from "zod";
import { InvalidListingError } from "../errors/listing.js";
import type { CountryPack } from "./country-pack.js";
import type {
	Attributes,
	GeoPoint,
	NewDwelling,
	Rooms,
	Size,
	SizeUnit,
} from "./dwelling.js";
import type { Market, Price } from "./offer.js";

/** What provider output must validate against before normalization. */
export const ListingSchema = z.object({
	listing_id: z.string().min(1),
	url: z.string().min(1),
	market: z.enum(["rent", "buy"]),
	price: z.object({
		amount: z.number(),
		currency: z.string().min(1),
		period: z.enum(["month", "once"]),
	}),
	address_text: z.string().min(1),
	bedrooms: z.number().optional(),
	description: z.string().optional(),
	images: z.array(z.string()).optional(),
	posted_at: z.string().optional(),
	extra: z.record(z.string(), z.unknown()).optional(),
});

/** A validated provider record, before it becomes domain facts. */
export type Listing = z.infer<typeof ListingSchema>;

/** Offer facts without identity. Provider, ids, and dwelling link are assigned by the pipeline. */
export interface NewOffer {
	listingId: string;
	url: string;
	market: Market;
	price: Price;
	images: string[];
	description: string;
	postedAt?: string;
	fetchedAt: string;
}

/** Everything normalization needs: raw provider output, the country pack, and fetch time. */
export interface NormalizeInput {
	listing: unknown;
	pack: CountryPack;
	fetchedAt: string;
}

export function normalizeListing(input: NormalizeInput): {
	dwelling: NewDwelling;
	offer: NewOffer;
} {
	const parsed = ListingSchema.safeParse(input.listing);
	if (!parsed.success) throw new InvalidListingError(parsed.error.message);
	return {
		dwelling: readDwelling(parsed.data, input.pack),
		offer: readOffer(parsed.data, input.fetchedAt),
	};
}

function readDwelling(listing: Listing, pack: CountryPack): NewDwelling {
	const extra = listing.extra ?? {};
	return {
		address: {
			freeText: listing.address_text,
			locality: readString(extra, "city"),
			region: readString(extra, "county"),
			geo: readGeo(extra),
		},
		size: readSize(extra, pack),
		rooms: readRooms(listing, extra),
		layout: pack.mapLayout(
			readString(extra, "propertyType") ??
				readString(extra, "type") ??
				"other",
		),
		yearBuilt: readNumber(extra, "yearBuilt"),
		floor: readNumber(extra, "floor"),
		floorsTotal: readNumber(extra, "floorsTotal"),
		attributes: readAttributes(extra, pack),
	};
}

function readOffer(listing: Listing, fetchedAt: string): NewOffer {
	return {
		listingId: listing.listing_id,
		url: listing.url,
		market: listing.market,
		price: listing.price,
		images: listing.images ?? [],
		description: listing.description ?? "",
		postedAt: listing.posted_at,
		fetchedAt,
	};
}

function readAttributes(
	extra: Record<string, unknown>,
	pack: CountryPack,
): Attributes {
	const parsed = pack.attributeSchema.safeParse(extra);
	if (!parsed.success)
		throw new InvalidListingError(
			`attributes rejected: ${parsed.error.message}`,
		);
	return parsed.data;
}

function readString(
	extra: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = extra[key];
	return typeof value === "string" ? value : undefined;
}

function readNumber(
	extra: Record<string, unknown>,
	key: string,
): number | undefined {
	const value = extra[key];
	return typeof value === "number" ? value : undefined;
}

function readGeo(extra: Record<string, unknown>): GeoPoint | undefined {
	const lat = readNumber(extra, "lat");
	const lng = readNumber(extra, "lng");
	if (lat === undefined || lng === undefined) return undefined;
	return { lat, lng };
}

function readSize(
	extra: Record<string, unknown>,
	pack: CountryPack,
): Size | undefined {
	const sizeKeys: Array<[string, SizeUnit]> = [
		["floorAreaSqM", "m2"],
		["sizeSqMeters", "m2"],
		["sizeM2", "m2"],
		["sizeSqFt", "sqft"],
		["sizeSqft", "sqft"],
		["size", pack.defaultSizeUnit],
	];
	for (const [key, unit] of sizeKeys) {
		const value = readNumber(extra, key);
		if (value !== undefined) return { value, unit };
	}
	return undefined;
}

function readRooms(
	listing: Listing,
	extra: Record<string, unknown>,
): Rooms | undefined {
	const bedrooms = listing.bedrooms ?? readNumber(extra, "bedrooms");
	const bathrooms = readNumber(extra, "bathrooms");
	if (bedrooms === undefined && bathrooms === undefined) return undefined;
	return { bedrooms, bathrooms };
}
