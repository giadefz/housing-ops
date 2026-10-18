import { MARKET_STATUSES } from "./decision.js";

/** The views the queue offers: the feed's pending state, or a judgment status. */
export const QUEUE_VIEWS = ["to-evaluate", ...MARKET_STATUSES] as const;

/** A queue view. `to-evaluate` lists the feed; every other view lists judged decisions. */
export type QueueView = (typeof QUEUE_VIEWS)[number];
