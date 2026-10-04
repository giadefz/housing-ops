import crypto from "node:crypto";
import type { CountryPack } from "../domain/country-pack.js";
import {
	createDwelling,
	type Dwelling,
	type NewDwelling,
} from "../domain/dwelling.js";
import { normalizeListing, type NewOffer } from "../domain/listing.js";
import type { Offer, OfferVersion } from "../domain/offer.js";
import { errorMessage } from "../errors/message.js";
import type { ScanResult } from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { FetchContext, ProviderPort } from "../ports/provider.port.js";
import type {
	DeadLetterEntry,
	OfferStorePort,
	RunStats,
} from "../ports/store.port.js";

export interface ScanDependencies {
	providers: ProviderPort[];
	store: OfferStorePort;
	pack: CountryPack;
	clock: ClockPort;
	paceMs?: number;
	log?: (message: string) => void;
}

interface ScanWiring {
	store: OfferStorePort;
	pack: CountryPack;
	clock: ClockPort;
	fetch: FetchContext;
}

const EMPTY_RESULT: ScanResult = { fetched: 0, stored: 0, deadLettered: 0 };
const FETCH_TIMEOUT_MS = 60_000;

type Outcome = "stored" | "deadLettered";

/** Fetches from each provider, normalizes, and stores. Every record is kept: bad ones go to dead-letter. */
export function scan(dependencies: ScanDependencies): Promise<ScanResult> {
	const { providers, store, pack, clock } = dependencies;
	const wiring: ScanWiring = {
		store,
		pack,
		clock,
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

async function storeRecord(job: RecordJob): Promise<Outcome> {
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
		await store.saveDwelling(dwelling);
		const offer = await resolveOffer({
			provider,
			newOffer: normalized.offer,
			dwellingId: dwelling.id,
			payload: record,
			wiring,
		});
		await store.saveOffer(offer);
		return "stored";
	} catch (error) {
		await store.recordDeadLetter(
			deadLetterEntry({ record, provider, runId, wiring, error }),
		);
		return "deadLettered";
	}
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

async function resolveOffer(job: OfferJob): Promise<Offer> {
	const { provider, newOffer, dwellingId, payload, wiring } = job;
	const { store } = wiring;
	const existing = await store.findOfferByListing(
		provider.id,
		newOffer.listingId,
	);
	return {
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
		status: existing?.status ?? "seen",
		analyses: existing?.analyses ?? [],
		interactions: existing?.interactions ?? [],
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

function countOutcome(outcome: Outcome): ScanResult {
	return outcome === "stored"
		? { fetched: 1, stored: 1, deadLettered: 0 }
		: { fetched: 1, stored: 0, deadLettered: 1 };
}

function addResults(left: ScanResult, right: ScanResult): ScanResult {
	return {
		fetched: left.fetched + right.fetched,
		stored: left.stored + right.stored,
		deadLettered: left.deadLettered + right.deadLettered,
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
