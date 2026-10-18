import type { Analysis, Interaction } from "../domain/analysis.js";
import type {
	Decision,
	MarketOutcome,
	MarketStatus,
	UserStatus,
} from "../domain/decision.js";
import type { Dwelling } from "../domain/dwelling.js";
import type { FeedCursor, FeedEntry } from "../domain/feed.js";
import type { Member } from "../domain/member.js";
import type { Offer } from "../domain/offer.js";
import type { QueueView } from "../domain/queue.js";
import type { Verdict } from "../domain/verdict.js";
import type { Config } from "../schemas/config.js";
import type { Profile } from "../schemas/profile.js";

/** An offer together with one member's standing on it. */
export interface MemberOffer {
	offer: Offer;
	decision: Decision;
}

/** An offer together with a member's feed entry. */
export interface FeedOffer {
	offer: Offer;
	feed: FeedEntry;
}

/** One pool row offered to a feed fill, with the member's judgment and feed membership. */
export interface PoolCandidate {
	offer: Offer;
	dwelling: Dwelling;
	enteredAt: string;
	marketStatus?: MarketStatus;
	inFeed: boolean;
}

/** A bounded page below a member's feed cursor. */
export interface PoolBatchQuery {
	memberId: string;
	cursor: FeedCursor | null;
	limit: number;
}

/** One queue entry. Compact by design: full payloads come from findOffer. */
export interface OfferSummary {
	id: string;
	provider: string;
	price: { amount: number; currency: string };
	addressShort: string;
	bedrooms?: number;
	sizeM2?: number;
	layout: string;
	marketStatus?: MarketStatus;
	userStatus: UserStatus;
	fetchedAt: string;
}

/** One value with how often it occurred. */
export interface FeatureCount {
	value: string;
	count: number;
}

/** Aggregates the profile digest needs, gathered at call time. */
export interface DigestData {
	favorited: OfferSummary[];
	rejectedCount: number;
	rejectedReasons: FeatureCount[];
	allPrices: number[];
	offerCount: number;
	viewedCount: number;
	layouts: FeatureCount[];
	bedrooms: FeatureCount[];
	ber: FeatureCount[];
}

/** One pipeline run's counters. */
export interface RunStats {
	fetched: number;
	normalized: number;
	passed: number;
	failed: number;
	skipped: number;
	stored: number;
}

/** A listing that failed normalization, kept for inspection. */
export interface DeadLetterEntry {
	runId: string;
	provider: string;
	payload: unknown;
	error: string;
	receivedAt: string;
}

/** A stored offer together with its dwelling, for pipeline dry-runs. */
export interface StoredOfferDetail {
	offer: Offer;
	dwelling: Dwelling;
}

/** A market outcome observation to append while closing an offer. */
export interface MarketOutcomeEvent {
	outcome: MarketOutcome;
	observedAt: string;
	runId?: string;
}

/** A member's offers filtered to one market status, capped by a limit. */
export interface OfferStatusQuery {
	status: MarketStatus;
	limit: number;
}

/** One page of a queue view. */
export interface QueueViewQuery {
	view: QueueView;
	limit: number;
}

/** A market outcome to apply, with the offer and every decision it closes. */
export interface MarketOutcomeCommand {
	offer: Offer;
	decisions: Decision[];
	event: MarketOutcomeEvent;
}

/** Persists and queries offers. Implemented by storage adapters. */
export interface OfferStorePort {
	saveDwelling(dwelling: Dwelling): Promise<void>;
	findDwellingByAddressKey(addressKey: string): Promise<Dwelling | null>;
	saveOffer(offer: Offer): Promise<void>;
	readConfig(): Promise<Config | null>;
	writeConfig(config: Config): Promise<void>;
	readMemberProfile(memberId: string): Promise<Profile | null>;
	writeMemberProfile(memberId: string, profile: Profile): Promise<void>;
	listMembers(): Promise<Member[]>;
	addToPool(offerId: string, enteredAt: string): Promise<string>;
	addToFeed(entry: FeedEntry): Promise<void>;
	findFeedEntry(memberId: string, offerId: string): Promise<FeedEntry | null>;
	listFeedOffers(memberId: string, limit: number): Promise<FeedOffer[]>;
	findFeedCursor(memberId: string): Promise<FeedCursor | null>;
	saveFeedCursor(cursor: FeedCursor): Promise<void>;
	deleteFeedCursor(memberId: string): Promise<void>;
	resetFeed(memberId: string): Promise<void>;
	listPoolBatch(query: PoolBatchQuery): Promise<PoolCandidate[]>;
	countFeed(memberId: string): Promise<number>;
	countUnjudged(memberId: string): Promise<number>;
	clearFeed(memberId: string): Promise<void>;
	findOffer(id: string): Promise<Offer | null>;
	findOfferByListing(
		provider: string,
		listingId: string,
	): Promise<Offer | null>;
	findDecision(memberId: string, offerId: string): Promise<Decision | null>;
	listDecisionsForOffer(offerId: string): Promise<Decision[]>;
	saveDecision(decision: Decision): Promise<void>;
	listMemberOffers(
		memberId: string,
		query: OfferStatusQuery,
	): Promise<MemberOffer[]>;
	recordVerdict(
		offerId: string,
		runId: string,
		verdict: Verdict,
	): Promise<void>;
	listVerdicts(offerId: string): Promise<Verdict[]>;
	recordAnalysis(analysis: Analysis): Promise<void>;
	listAnalyses(memberId: string, offerId: string): Promise<Analysis[]>;
	recordInteraction(interaction: Interaction): Promise<void>;
	listInteractions(memberId: string, offerId: string): Promise<Interaction[]>;
	listQueue(memberId: string, query: QueueViewQuery): Promise<OfferSummary[]>;
	countQueue(memberId: string, view: QueueView): Promise<number>;
	loadDigest(memberId: string): Promise<DigestData>;
	listStoredOffers(limit: number): Promise<StoredOfferDetail[]>;
	startRun(provider: string): Promise<string>;
	finishRun(runId: string, stats: RunStats): Promise<void>;
	recordDeadLetter(entry: DeadLetterEntry): Promise<void>;
	recordMarketOutcome(command: MarketOutcomeCommand): Promise<void>;
}

/** An open store plus its lifecycle. What composition holds and closes. */
export interface StoreHandle {
	store: OfferStorePort;
	close(): void;
}

/** What a store reports about itself: where it lives and which schema version is applied. */
export interface StoreDescription {
	/** Location relative to the workspace root, e.g. a file path or a connection name. */
	location: string;
	/** Applied schema version; null when the store does not exist yet. */
	schemaVersion: number | null;
}

/** Opens, creates, and describes a workspace's store. Implemented by each datastore adapter. */
export interface StoreFactory {
	/** The schema version this factory migrates to. */
	targetSchemaVersion: number;
	open(workspaceRoot: string): StoreHandle;
	describe(workspaceRoot: string): StoreDescription;
	init(workspaceRoot: string): StoreDescription;
}
