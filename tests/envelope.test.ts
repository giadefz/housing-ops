import { describe, expect, it } from "vitest";
import { API_VERSION, fail, ok } from "../src/api/envelope.js";

describe("envelope", () => {
  it("ok carries version and data", () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, version: API_VERSION, data: { a: 1 } });
  });

  it("fail carries code, message, and optional hint", () => {
    expect(fail("NOPE", "nope")).toEqual({
      ok: false,
      version: API_VERSION,
      error: { code: "NOPE", message: "nope" },
    });
    const withHint = fail("NOPE", "nope", "try this");
    expect(withHint.ok).toBe(false);
    if (!withHint.ok) expect(withHint.error.hint).toBe("try this");
  });
});
