/**
 * IP address utilities.
 * - Extract the real client IP honoring trusted reverse proxies (Nginx/Cloudflare).
 * - Match a client IP against an allow-list of plain IPs and CIDR ranges (IPv4 + IPv6).
 * Never trust client-submitted headers (X-Forwarded-For etc.) unless the proxy is trusted.
 */
import net from 'node:net';
import { config } from '../config';

type IpFamily = 'ipv4' | 'ipv6';

function familyOf(address: string): IpFamily | null {
  const version = net.isIP(address);
  if (version === 4) return 'ipv4';
  if (version === 6) return 'ipv6';
  return null;
}

export function ipMatchesCidr(clientIp: string, cidr: string): boolean {
  const [address, prefixRaw] = cidr.trim().split('/');
  const family = familyOf(address);
  if (!family) return false;

  // An IPv4 client must not match an IPv6 range (and vice versa).
  if (familyOf(clientIp) !== family) return false;

  const maxBits = family === 'ipv4' ? 32 : 128;
  const prefix = prefixRaw === undefined ? maxBits : Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxBits) return false;

  const list = new net.BlockList();
  list.addSubnet(address, prefix, family);
  return list.check(clientIp, family);
}

export function isIpAllowed(clientIp: string, allowed: string[]): boolean {
  if (!allowed || allowed.length === 0) return false;
  return allowed.some((entry) => ipMatchesCidr(clientIp, entry));
}

/** Extract the real client public IP from an Express request. */
export function clientIp(req: import('express').Request): string {
  // Render and other reverse proxies may expose the client address through one of
  // these headers. Only read them when TRUSTED_PROXY is explicitly enabled; otherwise
  // a direct client could forge an allow-listed IP and bypass the Wi-Fi restriction.
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwarded = config.trustedProxy
    ? (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : '')
      || req.headers['x-real-ip']
      || req.headers['cf-connecting-ip']
      || req.ip
    : req.socket.remoteAddress || req.ip;
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded || '';
  // Handle ::ffff:127.0.0.1 IPv4-mapped IPv6
  return value.trim().replace(/^::ffff:/, '');
}
