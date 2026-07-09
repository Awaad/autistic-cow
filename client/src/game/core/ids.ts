/**
 * Centralized ID generation — client side.
 * UUIDv7: 48-bit unix ms + version + 11-bit monotonic counter (rand_a,
 * RFC 9562 method 3) + 62 bits randomness. The counter guarantees ordering
 * for IDs minted within the same millisecond — matching server behavior
 * (uuid-utils) so client-minted event_ids keep B-tree locality too.
 */
let lastMs = -1;
let counter = 0;

export function newId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const nowMs = Date.now();
  if (nowMs === lastMs) {
    counter = (counter + 1) & 0x0fff; // 12-bit; wrap within one ms is unrealistic at our rates
  } else {
    lastMs = Math.max(nowMs, lastMs);
    counter = ((bytes[6] & 0x07) << 8) | bytes[7]; // 11-bit random start: ≥2048 headroom
  }

  const ms = BigInt(lastMs);
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  bytes[6] = 0x70 | ((counter >> 8) & 0x0f); // version 7 + counter high nibble
  bytes[7] = counter & 0xff;                 // counter low byte
  bytes[8] = (bytes[8] & 0x3f) | 0x80;       // variant

  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
