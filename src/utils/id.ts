// Lightweight short ID generator suitable for tool IDs on canvas
// Uses Web Crypto when available, falls back to Math.random for tests/SSR

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomInt(maxExclusive: number): number {
  // Prefer crypto.getRandomValues when available
  const cryptoObj = (globalThis as any).crypto as { getRandomValues?: (arr: Uint32Array) => Uint32Array } | undefined;
  if (cryptoObj?.getRandomValues) {
    // Generate a 32-bit number and mod by maxExclusive
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    return (buf[0] ?? 0) % maxExclusive;
  }
  // Fallback
  return Math.floor(Math.random() * maxExclusive);
}

export function randomId(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

export function generateUniqueId(existing: Set<string>, length = 8, maxAttempts = 10): string {
  let attempt = 0;
  let id = randomId(length);
  while (existing.has(id) && attempt < maxAttempts) {
    id = randomId(length);
    attempt++;
  }
  if (existing.has(id)) {
    // Extremely unlikely; fall back to timestamp-base36 + a random suffix
    const ts = Date.now().toString(36);
    const suffix = randomId(3);
    id = `${ts}${suffix}`;
  }
  return id;
}
