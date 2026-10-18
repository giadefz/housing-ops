import type { Analysis, Interaction } from "../domain/analysis.js";
import type { Decision, UserStatus } from "../domain/decision.js";
import type { Listing } from "../domain/listing.js";
import type { Offer } from "../domain/offer.js";
import type { PipelineEvent } from "../domain/events.js";
import type { Verdict } from "../domain/verdict.js";
import type { Profile } from "../schemas/profile.js";
import type { ConfigFile, SetupInput } from "../schemas/index.js";
import type {
	InteractionInput,
	ProfileGetInput,
	ProfileSetInput,
	PublishInput,
	QueueInput,
	VerdictInput,
} from "../schemas/requests.js";
import type { FeatureCount, OfferSummary } from "./store.port.js";

/** Core and api versions, for compatibility checks between core and interfaces. */
export interface VersionInfo {
	core: string;
	api: number;
}

/** One validation finding: what was examined, whether it passed, and the detail or fix. */
export interface Finding {
	name: string;
	ok: boolean;
	detail?: string;
}

/** The complete validation result: every finding in one place. */
export interface ValidationReport {
	findings: Finding[];
}

/** One offer with one member's decision, analyses, interactions, and the world's verdicts. */
export interface OfferDetail {
	offer: Offer;
	decision: Decision;
	analyses: Analysis[];
	interactions: Interaction[];
	verdicts: Verdict[];
}

/** A request for one offer, as seen by a member. */
export interface OfferQuery {
	memberId: string;
	offerId: string;
}

/** A request to record a judgment on a member's decision. */
export interface VerdictCommand {
	memberId: string;
	offerId: string;
	verdict: VerdictInput;
}

/** A request to record a member's reaction to an offer. */
export interface InteractionCommand {
	memberId: string;
	offerId: string;
	interaction: InteractionInput;
}

/** A request for a page of a member's queue. */
export interface QueueQuery {
	memberId: string;
	queue: QueueInput;
}

/** A request for a member's profile digest. */
export interface DigestQuery {
	memberId: string;
}

/** A request to re-deliver an event to a member's offers. */
export interface PublishQuery {
	memberId: string;
	publish: PublishInput;
}

/** A request to scan providers into the world's offers. */
export interface ScanQuery {
	memberId: string;
	providerId?: string;
}

/** One configured provider, as listed from providers.yml. */
export interface ProviderSummary {
	id: string;
	type: string;
	country: string;
	markets: string[];
	enabled: boolean;
}

/** The result of a capped provider trial. */
export interface ProviderTestResult {
	fetched: number;
	sample: Listing[];
}

/** The result of a scan run. */
export interface ScanResult {
	fetched: number;
	stored: number;
	deadLettered: number;
}

/** One page of the queue for a status, plus the total number of offers in it. */
export interface QueueResult {
	offers: OfferSummary[];
	total: number;
}

/** The id of the recorded judgment. */
export interface VerdictResult {
	analysisId: string;
}

/** The recorded reaction's id and the resulting user status. */
export interface InteractionResult {
	interactionId: string;
	userStatus: UserStatus;
}

/** A profile subtree and the path it came from. */
export interface ProfileValueResult {
	path: string | null;
	value: unknown;
}

/** The path and value written by a profile set. */
export interface ProfileSetResult {
	path: string;
	value: unknown;
}

/** A price distribution: min, median, and max. */
export interface PriceStats {
	min: number;
	median: number;
	max: number;
}

/** The profile digest: explicit profile plus interaction stats. */
export interface DigestStats {
	favorited: { count: number; offers: OfferSummary[] };
	rejected: { count: number; reasons: FeatureCount[] };
	priceBands: { favorited: PriceStats | null; overall: PriceStats | null };
	topFeatures: {
		layouts: FeatureCount[];
		bedrooms: FeatureCount[];
		ber: FeatureCount[];
	};
	seen: { viewed: number; total: number };
}

/** One digest run: the profile, the stats, and when it was generated. */
export interface DigestResult {
	profile: Profile;
	stats: DigestStats;
	generatedAt: string;
}

/** The result of a re-publish: which event, and how many offers it went out for. */
export interface PublishResult {
	event: PipelineEvent;
	published: number;
}

/** One configured filter, as listed from pipeline.yml. */
export interface FilterSummary {
	id: string;
	enabled: boolean;
	missing: "skip" | "fail";
	available: boolean;
}

/** One non-passing example from a filter dry-run. */
export interface FilterCheckExample {
	offerId: string;
	outcome: "pass" | "fail" | "skip";
	reason: string;
}

/** The distribution of a filter over stored offers. */
export interface FilterCheckResult {
	evaluated: number;
	pass: number;
	fail: number;
	skip: number;
	examples: FilterCheckExample[];
}

/** The result of setting up a workspace: the files written and the database path. */
export interface SetupResult {
	files: ConfigFile[];
	database: string;
}

/** The use-case surface every inbound (primary) adapter drives. Inbound adapters depend on this alone. */
export interface ApplicationPort {
	getVersion(): VersionInfo;
	validateWorkspace(): ValidationReport;
	setup(input: SetupInput, force: boolean): SetupResult;
	getOffer(input: OfferQuery): Promise<OfferDetail>;
	listProviders(): ProviderSummary[];
	listFilters(): FilterSummary[];
	checkFilter(id: string): Promise<FilterCheckResult>;
	testProvider(id: string): Promise<ProviderTestResult>;
	scan(input: ScanQuery): Promise<ScanResult>;
	listQueue(input: QueueQuery): Promise<QueueResult>;
	setVerdict(input: VerdictCommand): Promise<VerdictResult>;
	interact(input: InteractionCommand): Promise<InteractionResult>;
	getProfile(input: ProfileGetInput): ProfileValueResult;
	setProfile(input: ProfileSetInput): ProfileSetResult;
	getDigest(input: DigestQuery): Promise<DigestResult>;
	publishNow(input: PublishQuery): Promise<PublishResult>;
}
