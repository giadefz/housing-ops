import type {
	DigestResult,
	DigestStats,
	PriceStats,
} from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type {
	DigestData,
	FeatureCount,
	OfferStorePort,
} from "../ports/store.port.js";
import type { Profile } from "../schemas/profile.js";

const TOP_FEATURES = 5;

/** One request to build a member's profile digest. */
export interface DigestRequest {
	store: OfferStorePort;
	clock: ClockPort;
	profile: Profile;
	memberId: string;
}

/** Builds the deterministic digest: explicit profile plus the member's interaction stats. */
export async function buildDigest(
	request: DigestRequest,
): Promise<DigestResult> {
	const { store, clock, profile, memberId } = request;
	const data = await store.loadDigest(memberId);
	return { profile, stats: toStats(data), generatedAt: clock.now() };
}

function toStats(data: DigestData): DigestStats {
	return {
		favorited: { count: data.favorited.length, offers: data.favorited },
		rejected: { count: data.rejectedCount, reasons: data.rejectedReasons },
		priceBands: {
			favorited: priceStats(
				data.favorited.map((offer) => offer.price.amount),
			),
			overall: priceStats(data.allPrices),
		},
		topFeatures: {
			layouts: top(data.layouts),
			bedrooms: top(data.bedrooms),
			ber: top(data.ber),
		},
		seen: { viewed: data.viewedCount, total: data.offerCount },
	};
}

function priceStats(prices: number[]): PriceStats | null {
	if (prices.length === 0) return null;
	const sorted = [...prices].sort((left, right) => left - right);
	return {
		min: sorted[0] ?? 0,
		median: median(sorted),
		max: sorted[sorted.length - 1] ?? 0,
	};
}

function median(sorted: number[]): number {
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
	return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function top(counts: FeatureCount[]): FeatureCount[] {
	return counts.slice(0, TOP_FEATURES);
}
