import Database from "better-sqlite3";
import type {
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
import { listInteractions, recordInteraction } from "./interaction.js";
import { recordMarketOutcome } from "./market-event.js";
import { migrate } from "./migrate.js";
import {
	findOffer,
	findOfferByListing,
	listOfferIds,
	saveOffer,
} from "./offer.js";
import { countOffersByStatus, listQueue } from "./queue.js";
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
		countOffersByStatus: async (memberId, status) =>
			countOffersByStatus(database, memberId, status),
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
