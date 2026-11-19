import crypto from 'crypto';

/** Generate a random, unguessable QR token plus the hash that is persisted. */
export function makeQrToken() {
  const token = crypto.randomBytes(24).toString('hex');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
