// Portal tokens: 256 bits of CSPRNG randomness, URL-safe. Only the SHA-256 hash is stored.
// Uses the Web Crypto API (available in Node 20+, Edge runtime and browsers).
const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function generatePortalToken(): string {
  const bytes = new Uint8Array(32); // 32 bytes = 256 bits
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

export async function hashPortalToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cheap shape check before touching the database. */
export function looksLikePortalToken(t: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(t);
}

export const PORTAL_DEFAULT_DAYS = 90;
export function defaultExpiry(from = new Date(), days = PORTAL_DEFAULT_DAYS): Date {
  return new Date(from.getTime() + days * 86400000);
}
