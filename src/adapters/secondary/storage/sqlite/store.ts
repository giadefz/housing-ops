import Database from "better-sqlite3";
import type {
	FeedOffer,
	OfferStorePort,
	StoredOfferDetail,
} from "../../../../core/ports/store.port.js";
import { listAnalyses, recordAnalysis } from "./analysis.js";
import {
	findDecision,
	listDecisionsForOffer,
	listMemberOffers,
	saveDecision,
} from "./decision.js";
import { recordDeadLetter } from "./dead-letter.js";
import {
	findDwellingByAddressKey,
	findDwellingById,
	saveDwelling,
} from "./dwelling.js";
import { loadDigest } from "./digest.js";
import {
	addToFeed,
	clearFeed,
	clearFeedSync,
	countFeed,
	countUnjudged,
	findFeedEntry,
	listFeedEntries,
} from "./feed.js";
import {
	deleteFeedCursor,
	deleteFeedCursorSync,
	findFeedCursor,
	saveFeedCursor,
} from "./feed-cursor.js";
import { listInteractions, recordInteraction } from "./interaction.js";
import { recordMarketOutcome } from "./market-event.js";
import { migrate } from "./migrate.js";
import {
	findOffer,
	findOfferByListing,
	listOfferIds,
	saveOffer,
} from "./offer.js";
import { addToPool, listPoolBatch } from "./pool.js";
import { countQueue, listQueue } from "./queue.js";
import { finishRun, startRun } from "./run.js";
import { listVerdicts, recordVerdict } from "./verdict.js";

/** Opens a database file, migrating on open. Creates the file when missing. */
export function openStore(databaseFile: string): Database.Database {
	const database = new Database(databaseFile);
	migrate(database);
	return database;
}

/** Closes an open store. */
export function closeStore(database: Database.Database): void {
	database.close();
}

/** Binds the per-entity SQLite DAOs to the store port. */
export function createSqliteStore(database: Database.Database): OfferStorePort {
	return {
		saveDwelling: (dwelling) => saveDwelling(database, dwelling),
		findDwellingByAddressKey: (addressKey) =>
			findDwellingByAddressKey(database, addressKey),
		saveOffer: (offer) => saveOffer(database, offer),
		addToPool: (offerId, enteredAt) =>
			addToPool(database, offerId, enteredAt),
		addToFeed: (entry) => addToFeed(database, entry),
		findFeedEntry: async (memberId, offerId) =>
			findFeedEntry(database, memberId, offerId),
		listFeedOffers: async (memberId, limit) =>
			listFeedOffers(database, memberId, limit),
		findFeedCursor: async (memberId) => findFeedCursor(database, memberId),
		saveFeedCursor: (cursor) => saveFeedCursor(database, cursor),
		deleteFeedCursor: async (memberId) =>
			deleteFeedCursor(database, memberId),
		listPoolBatch: (query) => listPoolBatch(database, query),
		countFeed: async (memberId) => countFeed(database, memberId),
		countUnjudged: async (memberId) => countUnjudged(database, memberId),
		clearFeed: async (memberId) => clearFeed(database, memberId),
		resetFeed: async (memberId) => resetFeed(database, memberId),
		findOffer: (id) => findOffer(database, id),
		findOfferByListing: (provider, listingId) =>
			findOfferByListing(database, provider, listingId),
		findDecision: async (memberId, offerId) =>
			findDecision(database, memberId, offerId),
		listDecisionsForOffer: async (offerId) =>
			listDecisionsForOffer(database, offerId),
		saveDecision: (decision) => saveDecision(database, decision),
		listMemberOffers: (memberId, query) =>
			listMemberOffers(database, memberId, query),
		recordVerdict: (offerId, runId, verdict) =>
			recordVerdict(database, offerId, runId, verdict),
		listVerdicts: async (offerId) => listVerdicts(database, offerId),
		recordAnalysis: (analysis) => recordAnalysis(database, analysis),
		listAnalyses: async (memberId, offerId) =>
			listAnalyses(database, memberId, offerId),
		recordInteraction: (interaction) =>
			recordInteraction(database, interaction),
		listInteractions: async (memberId, offerId) =>
			listInteractions(database, memberId, offerId),
		listQueue: async (memberId, query) =>
			listQueue(database, memberId, query),
		countQueue: async (memberId, view) =>
			countQueue(database, memberId, view),
		loadDigest: async (memberId) => loadDigest(database, memberId),
		listStoredOffers: async (limit) => listStoredOffers(database, limit),
		startRun: (provider) => startRun(database, provider),
		finishRun: (runId, stats) => finishRun(database, runId, stats),
		recordDeadLetter: async (entry) => {
			recordDeadLetter(database, entry);
		},
		recordMarketOutcome: async (command) =>
			recordMarketOutcome(database, command),
	};
}

async function listStoredOffers(
	database: Database.Database,
	limit: number,
): Promise<StoredOfferDetail[]> {
	const details: StoredOfferDetail[] = [];
	for (const id of listOfferIds(database, limit)) {
		const offer = await findOffer(database, id);
		const dwelling =
			offer === null
				? null
				: await findDwellingById(database, offer.dwellingId);
		if (offer !== null && dwelling !== null)
			details.push({ offer, dwelling });
	}
	return details;
}

async function listFeedOffers(
	database: Database.Database,
	memberId: string,
	limit: number,
): Promise<FeedOffer[]> {
	const offers: FeedOffer[] = [];
	for (const feed of await listFeedEntries(database, memberId, limit)) {
		const offer = await findOffer(database, feed.offerId);
		if (offer !== null) offers.push({ offer, feed });
	}
	return offers;
}

async function resetFeed(
	database: Database.Database,
	memberId: string,
): Promise<void> {
	const reset = database.transaction(() => {
		clearFeedSync(database, memberId);
		deleteFeedCursorSync(database, memberId);
	});
	reset();
}
