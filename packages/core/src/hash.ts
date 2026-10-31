/**
 * Isomorphic hashing helpers (Node >= 20 and browsers) built on Web Crypto.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Deterministic JSON: object keys sorted recursively, no whitespace.
 * Rejects values that do not round-trip (undefined, bigint, NaN, functions).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalise(value, '$'));
}

function normalise(value: unknown, path: string): JsonValue {
  if (value === null) return null;
  switch (typeof value) {
    case 'boolean':
    case 'string':
      return value;
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`Non-finite number at ${path}`);
      return value;
    case 'object': {
      if (Array.isArray(value)) return value.map((v, i) => normalise(v, `${path}[${i}]`));
      if (value instanceof Date) return value.toISOString();
      const out: Record<string, JsonValue> = {};
      for (const key of Object.keys(value as object).sort()) {
        const v = (value as Record<string, unknown>)[key];
        if (v === undefined) continue;
        out[key] = normalise(v, `${path}.${key}`);
      }
      return out;
    }
    default:
      throw new TypeError(`Unsupported ${typeof value} at ${path}; convert bigint to string first`);
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
