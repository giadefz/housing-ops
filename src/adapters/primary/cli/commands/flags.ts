/** Reads an argv flag as a non-empty string. */
export function readString(
	flag: string | boolean | undefined,
): string | undefined {
	return typeof flag === "string" && flag.length > 0 ? flag : undefined;
}

/** Reads a comma-separated argv flag as a list of trimmed items. */
export function readList(
	flag: string | boolean | undefined,
): string[] | undefined {
	if (typeof flag !== "string") return undefined;
	const items = flag
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return items.length > 0 ? items : undefined;
}

/** Reads an argv flag as a number. */
export function readNumber(
	flag: string | boolean | undefined,
): number | undefined {
	return typeof flag === "string" && flag.length > 0
		? Number(flag)
		: undefined;
}
