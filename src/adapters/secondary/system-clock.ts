import type { ClockPort } from "../../core/ports/clock.port.js";

/** The system clock: the default ClockPort adapter. */
export const systemClock: ClockPort = {
	now: () => new Date().toISOString(),
};
