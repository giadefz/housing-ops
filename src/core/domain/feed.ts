/** Every state a feed entry can hold: waiting for judgment, or flowed straight through. */
export const FEED_STATES = ["to-evaluate", "accepted"] as const;

/** Where one offer sits in a member's feed. */
export type FeedState = (typeof FEED_STATES)[number];

/** One offer in a member's feed, and how it entered. */
export interface FeedEntry {
	memberId: string;
	offerId: string;
	addedAt: string;
	state: FeedState;
}

/** A member's place in the pool while filling the feed. */
export interface FeedCursor {
	memberId: string;
	enteredAt: string;
	offerId: string;
}
