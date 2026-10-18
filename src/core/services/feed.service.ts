import type { FeedCursor, FeedEntry } from "../domain/feed.js";
import type { Offer } from "../domain/offer.js";
import type { FeedFillResult, FeedStatus } from "../ports/application.port.js";
import type { EventBus } from "../ports/event-bus.port.js";
import type { OfferStorePort, PoolCandidate } from "../ports/store.port.js";
import {
	DEFAULT_FEED_BATCH,
	DEFAULT_FEED_TARGET,
	type Profile,
} from "../schemas/profile.js";
import { runFilters, type FilterStage } from "./pipeline.service.js";

/** One request to fill a member's feed from the pool. */
export interface FillFeedRequest {
	store: OfferStorePort;
	events: EventBus;
	profile: Profile;
	filters: FilterStage[];
	memberId: string;
}

/** One request to read or clear a member's feed. */
export interface FeedStatusRequest {
	store: OfferStorePort;
	memberId: string;
}

interface FillSettings {
	target: number;
	batch: number;
}

/** Reads the feed target and batch size, falling back to the defaults. */
function feedSettings(profile: Profile): FillSettings {
	return {
		target: profile.feed?.target ?? DEFAULT_FEED_TARGET,
		batch: profile.feed?.batch ?? DEFAULT_FEED_BATCH,
	};
}

/** Reads how much of a member's feed is judged. */
export async function getFeedStatus(
	request: FeedStatusRequest,
): Promise<FeedStatus> {
	const total = await request.store.countFeed(request.memberId);
	const unjudged = await request.store.countUnjudged(request.memberId);
	return { total, unjudged, judged: total - unjudged };
}

/** Clears a member's feed and pool bookmark. Decisions and the pool are untouched. */
export async function emptyFeed(
	request: FeedStatusRequest,
): Promise<FeedStatus> {
	await request.store.resetFeed(request.memberId);
	return getFeedStatus(request);
}

/** Fills a member's feed with one bounded batch of pool candidates. */
export async function fillFeed(
	request: FillFeedRequest,
): Promise<FeedFillResult> {
	const settings = feedSettings(request.profile);
	const before = await getFeedStatus(request);
	if (before.unjudged >= settings.target)
		return { ...before, added: 0, hasMore: false };
	const batch = await fillBatch({
		request,
		settings,
		unjudged: before.unjudged,
	});
	const after = await getFeedStatus(request);
	return { ...after, added: batch.added, hasMore: batch.hasMore };
}

interface FillBatchRequest {
	request: FillFeedRequest;
	settings: FillSettings;
	unjudged: number;
}

interface FillBatchOutcome {
	added: number;
	hasMore: boolean;
}

async function fillBatch(input: FillBatchRequest): Promise<FillBatchOutcome> {
	const { request, settings, unjudged } = input;
	const candidates = await request.store.listPoolBatch({
		memberId: request.memberId,
		cursor: await request.store.findFeedCursor(request.memberId),
		limit: settings.batch,
	});
	const outcome = await addCandidates({
		candidates,
		request,
		target: settings.target,
		unjudged,
	});
	if (outcome.cursor !== null)
		await request.store.saveFeedCursor(outcome.cursor);
	return {
		added: outcome.added,
		hasMore: !outcome.reachedTarget && candidates.length === settings.batch,
	};
}

interface AddCandidatesRequest {
	candidates: PoolCandidate[];
	request: FillFeedRequest;
	target: number;
	unjudged: number;
}

interface FillOutcome {
	added: number;
	cursor: FeedCursor | null;
	reachedTarget: boolean;
}

async function addCandidates(
	input: AddCandidatesRequest,
): Promise<FillOutcome> {
	let added = 0;
	let cursor: FeedCursor | null = null;
	for (const candidate of input.candidates) {
		cursor = cursorOf(input.request.memberId, candidate);
		if (!(await addIfEligible(candidate, input.request))) continue;
		added += 1;
		if (input.unjudged + added >= input.target)
			return { added, cursor, reachedTarget: true };
	}
	return { added, cursor, reachedTarget: false };
}

async function addIfEligible(
	candidate: PoolCandidate,
	request: FillFeedRequest,
): Promise<boolean> {
	if (candidate.marketStatus !== undefined) return false;
	if (candidate.inFeed) return false;
	const run = runFilters(request.filters, {
		offer: candidate.offer,
		dwelling: candidate.dwelling,
		profile: request.profile,
		comparables: [],
	});
	if (!run.passed) return false;
	await addFeedEntry({
		offer: candidate.offer,
		addedAt: candidate.enteredAt,
		request,
	});
	return true;
}

function cursorOf(memberId: string, candidate: PoolCandidate): FeedCursor {
	return {
		memberId,
		enteredAt: candidate.enteredAt,
		offerId: candidate.offer.id,
	};
}

interface AddFeedEntryRequest {
	offer: Offer;
	addedAt: string;
	request: FillFeedRequest;
}

async function addFeedEntry(job: AddFeedEntryRequest): Promise<void> {
	const { offer, addedAt, request } = job;
	const entry: FeedEntry = {
		memberId: request.memberId,
		offerId: offer.id,
		addedAt,
		state: request.profile.gate ? "to-evaluate" : "accepted",
	};
	await request.store.addToFeed(entry);
	await request.events.emit("offer.passed", { offer, feed: entry });
}
