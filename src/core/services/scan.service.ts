import crypto from "node:crypto";
import type { CountryPack } from "../domain/country-pack.js";
import {
	createDwelling,
	type Dwelling,
	type NewDwelling,
} from "../domain/dwelling.js";
import type { PipelineEvent } from "../domain/events.js";
import { normalizeListing, type NewOffer } from "../domain/listing.js";
import {
	clearFilters,
	parkForJudgment,
	type Offer,
	type OfferVersion,
} from "../domain/offer.js";
import type { Verdict } from "../domain/verdict.js";
import { errorMessage } from "../errors/message.js";
import type { ScanResult } from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { DispatchOutcome, EventPort } from "../ports/event.port.js";
import type { FetchContext, ProviderPort } from "../ports/provider.port.js";
import type {
	DeadLetterEntry,
	OfferStorePort,
	RunStats,
} from "../ports/store.port.js";
import type { Profile } from "../schemas/profile.js";
import { runFilters, type FilterStage } from "./pipeline.service.js";

export interface ScanDependencies {
	providers: ProviderPort[];
	events?: EventPort;
	store: OfferStorePort;
	pack: CountryPack;
	clock: ClockPort;
	profile: Profile;
	filters: FilterStage[];
	paceMs?: number;
	log?: (message: string) => void;
}

interface ScanWiring {
	store: OfferStorePort;
	events: EventPort;
	pack: CountryPack;
	clock: ClockPort;
	profile: Profile;
	filters: FilterStage[];
	fetch: FetchContext;
}

const EMPTY_RESULT: ScanResult = {
	fetched: 0,
	stored: 0,
	deadLettered: 0,
	published: 0,
	publishFailed: 0,
};
const NO_EVENTS: EventPort = {
	async emit() {
		return [];
	},
};
const FETCH_TIMEOUT_MS = 60_000;

/** Fetches from each provider, normalizes, filters, stores, and publishes. Bad records go to dead-letter. */
export function scan(dependencies: ScanDependencies): Promise<ScanResult> {
	const {
		providers,
		events = NO_EVENTS,
		store,
		pack,
		clock,
		profile,
		filters,
	} = dependencies;
	const wiring: ScanWiring = {
		store,
		events,
		pack,
		clock,
		profile,
		filters,
		fetch: createFetchContext(dependencies),
	};
	return providers.reduce(
		async (previous, provider) =>
			addResults(await previous, await scanProvider(provider, wiring)),
		Promise.resolve(EMPTY_RESULT),
	);
}

async function scanProvider(
	provider: ProviderPort,
	wiring: ScanWiring,
): Promise<ScanResult> {
	const { store } = wiring;
	const runId = await store.startRun(provider.id);
	const result = await foldRecords(provider, runId, wiring);
	await store.finishRun(runId, toRunStats(result));
	return result;
}

async function foldRecords(
	provider: ProviderPort,
	runId: string,
	wiring: ScanWiring,
): Promise<ScanResult> {
	let result = EMPTY_RESULT;
	for await (const record of provider.fetch({}, wiring.fetch)) {
		const outcome = await storeRecord({ record, provider, runId, wiring });
		result = addResults(result, countOutcome(outcome));
	}
	return result;
}

interface RecordJob {
	record: unknown;
	provider: ProviderPort;
	runId: string;
	wiring: ScanWiring;
}

interface RecordOutcome {
	stored: boolean;
	published: number;
	publishFailed: number;
}

async function storeRecord(job: RecordJob): Promise<RecordOutcome> {
	const outcome = await tryStore(job);
	if (!outcome.stored)
		return { stored: false, published: 0, publishFailed: 0 };
	return {
		stored: true,
		...(await emitFor(outcome.judged, outcome.changed, job.wiring.events)),
	};
}

type StoreOutcome =
	{ stored: true; judged: Judged; changed: boolean } | { stored: false };

async function tryStore(job: RecordJob): Promise<StoreOutcome> {
	const { record, provider, runId, wiring } = job;
	const { store, pack, clock } = wiring;
	try {
		const fetchedAt = clock.now();
		const normalized = normalizeListing({
			listing: record,
			pack,
			fetchedAt,
		});
		const dwelling = await resolveDwelling(normalized.dwelling, wiring);
		const resolved = await resolveOffer({
			provider,
			newOffer: normalized.offer,
			dwellingId: dwelling.id,
			payload: record,
			wiring,
		});
		const judged = judge(resolved.offer, dwelling, wiring);
		await store.saveDwelling(dwelling);
		await store.saveOffer(judged.offer);
		await recordVerdicts(store, judged.offer.id, runId, judged.verdicts);
		return { stored: true, judged, changed: resolved.changed };
	} catch (error) {
		await store.recordDeadLetter(
			deadLetterEntry({ record, provider, runId, wiring, error }),
		);
		return { stored: false };
	}
}

interface PublishCounts {
	published: number;
	publishFailed: number;
}

async function emitFor(
	judged: Judged,
	changed: boolean,
	events: EventPort,
): Promise<PublishCounts> {
	const event = scanEvent(judged, changed);
	if (event === null) return { published: 0, publishFailed: 0 };
	return countDeliveries(await events.emit(event, { offer: judged.offer }));
}

/** The milestone a stored offer emits, if any. */
function scanEvent(judged: Judged, changed: boolean): PipelineEvent | null {
	if (judged.passed) return "offer.passed";
	if (changed) return "offer.updated";
	return null;
}

function countDeliveries(outcomes: DispatchOutcome[]): PublishCounts {
	let published = 0;
	let publishFailed = 0;
	for (const outcome of outcomes) {
		if (outcome.ok) published += 1;
		else publishFailed += 1;
	}
	return { published, publishFailed };
}

interface Judged {
	offer: Offer;
	verdicts: Verdict[];
	passed: boolean;
}

/** Runs the pipeline on a first sighting; a filtered-out offer stays "seen". */
function judge(offer: Offer, dwelling: Dwelling, wiring: ScanWiring): Judged {
	if (offer.marketStatus !== "seen")
		return { offer, verdicts: [], passed: false };
	const run = runFilters(wiring.filters, {
		offer,
		dwelling,
		profile: wiring.profile,
		comparables: [],
	});
	if (!run.passed) return { offer, verdicts: run.verdicts, passed: false };
	return {
		offer: wiring.profile.gate
			? parkForJudgment(offer)
			: clearFilters(offer),
		verdicts: run.verdicts,
		passed: true,
	};
}

async function recordVerdicts(
	store: OfferStorePort,
	offerId: string,
	runId: string,
	verdicts: Verdict[],
): Promise<void> {
	for (const verdict of verdicts)
		await store.recordVerdict(offerId, runId, verdict);
}

async function resolveDwelling(
	newDwelling: NewDwelling,
	wiring: ScanWiring,
): Promise<Dwelling> {
	const { store, pack } = wiring;
	const attributes = pack.attributeSchema.parse(newDwelling.attributes);
	const addressKey = pack.addressKey(newDwelling.address, attributes);
	const existing = await store.findDwellingByAddressKey(addressKey);
	const id = existing?.id ?? crypto.randomUUID();
	return createDwelling({ ...newDwelling, attributes, id }, pack);
}

interface OfferJob {
	provider: ProviderPort;
	newOffer: NewOffer;
	dwellingId: string;
	payload: unknown;
	wiring: ScanWiring;
}

interface ResolvedOffer {
	offer: Offer;
	changed: boolean;
}

async function resolveOffer(job: OfferJob): Promise<ResolvedOffer> {
	const { provider, newOffer, dwellingId, payload, wiring } = job;
	const { store } = wiring;
	const existing = await store.findOfferByListing(
		provider.id,
		newOffer.listingId,
	);
	return {
		offer: {
			id: existing?.id ?? crypto.randomUUID(),
			dwellingId,
			provider: provider.id,
			listingId: newOffer.listingId,
			url: newOffer.url,
			market: newOffer.market,
			price: newOffer.price,
			images: newOffer.images,
			description: newOffer.description,
			postedAt: newOffer.postedAt,
			fetchedAt: newOffer.fetchedAt,
			versions: nextVersions({ existing, newOffer, payload }),
			marketStatus: existing?.marketStatus ?? "seen",
			userStatus: existing?.userStatus ?? "none",
			analyses: existing?.analyses ?? [],
			interactions: existing?.interactions ?? [],
		},
		changed: existing !== null && hasChanged(existing, newOffer),
	};
}

interface VersionJob {
	existing: Offer | null;
	newOffer: NewOffer;
	payload: unknown;
}

/** A version is recorded only when the listing changed, so history means "a change happened". */
function nextVersions(job: VersionJob): OfferVersion[] {
	const { existing, newOffer, payload } = job;
	if (existing === null) return [snapshot(1, newOffer, payload)];
	if (!hasChanged(existing, newOffer)) return existing.versions;
	const version = existing.versions.length + 1;
	return [...existing.versions, snapshot(version, newOffer, payload)];
}

function snapshot(
	version: number,
	newOffer: NewOffer,
	payload: unknown,
): OfferVersion {
	return {
		version,
		fetchedAt: newOffer.fetchedAt,
		price: newOffer.price,
		payload,
	};
}

function hasChanged(existing: Offer, newOffer: NewOffer): boolean {
	return (
		existing.price.amount !== newOffer.price.amount ||
		existing.price.currency !== newOffer.price.currency ||
		existing.price.period !== newOffer.price.period ||
		existing.url !== newOffer.url ||
		existing.market !== newOffer.market ||
		existing.description !== newOffer.description ||
		existing.postedAt !== newOffer.postedAt ||
		JSON.stringify(existing.images) !== JSON.stringify(newOffer.images)
	);
}

interface DeadLetterJob {
	record: unknown;
	provider: ProviderPort;
	runId: string;
	wiring: ScanWiring;
	error: unknown;
}

function deadLetterEntry(job: DeadLetterJob): DeadLetterEntry {
	const { clock } = job.wiring;
	return {
		runId: job.runId,
		provider: job.provider.id,
		payload: job.record,
		error: errorMessage(job.error),
		receivedAt: clock.now(),
	};
}

function countOutcome(outcome: RecordOutcome): ScanResult {
	return {
		fetched: 1,
		stored: outcome.stored ? 1 : 0,
		deadLettered: outcome.stored ? 0 : 1,
		published: outcome.published,
		publishFailed: outcome.publishFailed,
	};
}

function addResults(left: ScanResult, right: ScanResult): ScanResult {
	return {
		fetched: left.fetched + right.fetched,
		stored: left.stored + right.stored,
		deadLettered: left.deadLettered + right.deadLettered,
		published: left.published + right.published,
		publishFailed: left.publishFailed + right.publishFailed,
	};
}

function toRunStats(result: ScanResult): RunStats {
	return {
		fetched: result.fetched,
		normalized: result.stored,
		passed: result.stored,
		failed: result.deadLettered,
		skipped: 0,
		stored: result.stored,
		published: result.published,
		publishFailed: result.publishFailed,
	};
}

function createFetchContext(dependencies: ScanDependencies): FetchContext {
	const { paceMs = 0, log = () => {} } = dependencies;
	return {
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		pace: async () => {
			if (paceMs > 0) await sleep(paceMs);
		},
		log,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
