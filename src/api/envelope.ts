// JSON envelope every command prints to stdout. Versioned per docs/design/api.md.

export const API_VERSION = 1;
export const CORE_VERSION = "0.1.0";

export interface OkEnvelope<T> {
  ok: true;
  version: number;
  data: T;
}

export interface FailEnvelope {
  ok: false;
  version: number;
  error: { code: string; message: string; hint?: string };
}

export type Envelope<T> = OkEnvelope<T> | FailEnvelope;

export function ok<T>(data: T): Envelope<T> {
  return { ok: true, version: API_VERSION, data };
}

export function fail(
  code: string,
  message: string,
  hint?: string,
): Envelope<never> {
  return {
    ok: false,
    version: API_VERSION,
    error: hint ? { code, message, hint } : { code, message },
  };
}
