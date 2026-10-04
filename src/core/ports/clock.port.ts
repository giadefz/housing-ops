/** Current time as ISO string. Injected so time-dependent logic stays testable. */
export interface ClockPort {
	now(): string;
}
