import crypto from "node:crypto";
import type { CountryPack } from "../domain/country-pack.js";
import {
	createDwelling,
	type Dwelling,
	type NewDwelling,
} from "../domain/dwelling.js";
import type { FeedEntry, FeedMember } from "../domain/feed.js";
import { normalizeListing, type NewOffer } from "../domain/listing.js";
import type { Offer, OfferVersion } from "../domain/offer.js";
import type { Verdict } from "../domain/verdict.js";
import { errorMessage } from "../errors/message.js";
import type { ScanResult } from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { EventBus } from "../ports/event-bus.port.js";
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
	events: EventBus;
	store: OfferStorePort;
	pack: CountryPack;
	clock: ClockPort;
	poolProfile: Profile;
	filters: FilterStage[];
	members: FeedMember[];
	paceMs?: number;
	log?: (message: string) => void;
}

interface ScanWiring {
	store: OfferStorePort;
	events: EventBus;
	pack: CountryPack;
	clock: ClockPort;
	poolProfile: Profile;
	filters: FilterStage[];
	members: FeedMember[];
	fetch: FetchContext;
}

/** An offer the pool phase let through, with the dwelling the member filter needs. */
interface PooledOffer {
	offer: Offer;
	dwelling: Dwelling;
	enteredAt: string;
	changed: boolean;
}

/** One provider's contribution to the pool phase. */
interface PoolPhase {
	result: ScanResult;
	pooled: PooledOffer[];
}

const EMPTY_RESULT: ScanResult = { fetched: 0, stored: 0, deadLettered: 0 };
const EMPTY_PHASE: PoolPhase = { result: EMPTY_RESULT, pooled: [] };
const FETCH_TIMEOUT_MS = 60_000;

/** Fetches each provider into the pool, then builds the member's feed from what the scan pooled. */
export function scan(dependencies: ScanDependencies): Promise<ScanResult> {
	const wiring = toWiring(dependencies);
	return runPoolPhase(dependencies.providers, wiring).then((phase) =>
		buildFeed(wiring, phase.pooled).then(() => phase.result),
	);
}

function toWiring(dependencies: ScanDependencies): ScanWiring {
	const { store, events, pack, clock, poolProfile, filters, members } =
		dependencies;
	return {
		store,
		events,
		pack,
		clock,
		poolProfile,
		filters,
		members,
		fetch: createFetchContext(dependencies),
	};
}

async function runPoolPhase(
	providers: ProviderPort[],
	wiring: ScanWiring,
): Promise<PoolPhase> {
	return providers.reduce(
		async (previous, provider) =>
			mergePhases(await previous, await scanProvider(provider, wiring)),
		Promise.resolve(EMPTY_PHASE),
	);
}

async function scanProvider(
	provider: ProviderPort,
	wiring: ScanWiring,
): Promise<PoolPhase> {
	const runId = await wiring.store.startRun(provider.id);
	const phase = await foldRecords(provider, runId, wiring);
	await wiring.store.finishRun(runId, toRunStats(phase));
	return phase;
}

async function foldRecords(
	provider: ProviderPort,
	runId: string,
	wiring: ScanWiring,
): Promise<PoolPhase> {
	const pooled: PooledOffer[] = [];
	let result = EMPTY_RESULT;
	for await (const record of provider.fetch({}, wiring.fetch)) {
		const outcome = await storeRecord({ record, provider, runId, wiring });
		result = addResults(result, outcomeResult(outcome));
		if (outcome.kind === "pooled") pooled.push(outcome.pooled);
	}
	return { result, pooled };
}

interface RecordJob {
	record: unknown;
	provider: ProviderPort;
	runId: string;
	wiring: ScanWiring;
}

type RecordOutcome =
	| { kind: "stored" }
	| { kind: "deadLettered" }
	| { kind: "pooled"; pooled: PooledOffer };

async function storeRecord(job: RecordJob): Promise<RecordOutcome> {
	try {
		return await tryStore(job);
	} catch (error) {
		await job.wiring.store.recordDeadLetter(
			deadLetterEntry({ ...job, error }),
		);
		return { kind: "deadLettered" };
	}
}

async function tryStore(job: RecordJob): Promise<RecordOutcome> {
	const { record, provider, runId, wiring } = job;
	const { store, pack, clock } = wiring;
	const fetchedAt = clock.now();
	const normalized = normalizeListing({ listing: record, pack, fetchedAt });
	const dwelling = await resolveDwelling(normalized.dwelling, wiring);
	const resolved = await resolveOffer({
		provider,
		newOffer: normalized.offer,
		dwellingId: dwelling.id,
		payload: record,
		wiring,
	});
	const pool = judgePool({
		offer: resolved.offer,
		dwelling,
		resolved,
		wiring,
	});
	await store.saveDwelling(dwelling);
	await store.saveOffer(resolved.offer);
	await recordVerdicts(store, resolved.offer.id, runId, pool.verdicts);
	if (!pool.passed) return { kind: "stored" };
	const enteredAt = await store.addToPool(resolved.offer.id, fetchedAt);
	return {
		kind: "pooled",
		pooled: {
			offer: resolved.offer,
			dwelling,
			enteredAt,
			changed: resolved.changed,
		},
	};
}

interface PoolJob {
	offer: Offer;
	dwelling: Dwelling;
	resolved: ResolvedOffer;
	wiring: ScanWiring;
}

interface PoolOutcome {
	verdicts: Verdict[];
	passed: boolean;
}

/** Runs the pool filter on a new or changed offer. An unchanged offer is skipped. */
function judgePool(job: PoolJob): PoolOutcome {
	const { offer, dwelling, resolved, wiring } = job;
	if (!resolved.isNew && !resolved.changed)
		return { verdicts: [], passed: false };
	const run = runFilters(wiring.filters, {
		offer,
		dwelling,
		profile: wiring.poolProfile,
		comparables: [],
	});
	return { verdicts: run.verdicts, passed: run.passed };
}

/** Adds each pooled offer to every member's feed when their profile lets it through. */
async function buildFeed(
	wiring: ScanWiring,
	pooled: PooledOffer[],
): Promise<void> {
	for (const member of wiring.members)
		for (const entry of pooled)
			await placeInFeed({ entry, member, wiring });
}

interface PlaceInFeedJob {
	entry: PooledOffer;
	member: FeedMember;
	wiring: ScanWiring;
}

async function placeInFeed(job: PlaceInFeedJob): Promise<void> {
	const { entry, member, wiring } = job;
	const { offer, dwelling, enteredAt, changed } = entry;
	const existing = await wiring.store.findFeedEntry(
		member.memberId,
		offer.id,
	);
	if (existing !== null) {
		if (changed)
			await publishUpdate({ offer, feed: existing, member, wiring });
		return;
	}
	const run = runFilters(wiring.filters, {
		offer,
		dwelling,
		profile: member.profile,
		comparables: [],
	});
	if (run.passed)
		await publishFeedEntry({ offer, enteredAt, member, wiring });
}

async function publishFeedEntry(job: {
	offer: Offer;
	enteredAt: string;
	member: FeedMember;
	wiring: ScanWiring;
}): Promise<void> {
	const { offer, enteredAt, member, wiring } = job;
	const entry: FeedEntry = {
		memberId: member.memberId,
		offerId: offer.id,
		addedAt: enteredAt,
		state: member.profile.gate ? "to-evaluate" : "accepted",
	};
	await wiring.store.addToFeed(entry);
	await wiring.events.emit("offer.passed", { offer, feed: entry });
}

async function publishUpdate(job: {
	offer: Offer;
	feed: FeedEntry;
	member: FeedMember;
	wiring: ScanWiring;
}): Promise<void> {
	const { offer, feed, member, wiring } = job;
	const decision = await wiring.store.findDecision(member.memberId, offer.id);
	await wiring.events.emit("offer.updated", {
		offer,
		feed,
		...(decision === null ? {} : { decision }),
	});
}

function outcomeResult(outcome: RecordOutcome): ScanResult {
	if (outcome.kind === "deadLettered")
		return { fetched: 1, stored: 0, deadLettered: 1 };
	return { fetched: 1, stored: 1, deadLettered: 0 };
}

function mergePhases(left: PoolPhase, right: PoolPhase): PoolPhase {
	return {
		result: addResults(left.result, right.result),
		pooled: [...left.pooled, ...right.pooled],
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
	isNew: boolean;
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
		},
		changed: existing !== null && hasChanged(existing, newOffer),
		isNew: existing === null,
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

function addResults(left: ScanResult, right: ScanResult): ScanResult {
	return {
		fetched: left.fetched + right.fetched,
		stored: left.stored + right.stored,
		deadLettered: left.deadLettered + right.deadLettered,
	};
}

function toRunStats(phase: PoolPhase): RunStats {
	return {
		fetched: phase.result.fetched,
		normalized: phase.result.stored,
		passed: phase.pooled.length,
		failed: phase.result.deadLettered,
		skipped: 0,
		stored: phase.result.stored,
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
