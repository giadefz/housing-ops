import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli/index.js";

describe("parseArgs", () => {
  it("parses command, flags, and rest", () => {
    expect(parseArgs(["node", "cli", "scan", "--provider", "daft", "extra"])).toEqual({
      command: "scan",
      flags: { provider: "daft" },
      rest: ["extra"],
    });
  });

  it("parses --key=value and boolean flags", () => {
    expect(parseArgs(["node", "cli", "--dry-run", "--limit=5"])).toEqual({
      command: null,
      flags: { "dry-run": true, limit: "5" },
      rest: [],
    });
  });
});
