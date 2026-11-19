/**
 * IP address utilities.
 * - Extract the real client IP honoring trusted reverse proxies (Nginx/Cloudflare).
 * - Match a client IP against an allow-list of plain IPs and CIDR ranges (IPv4 + IPv6).
 * Never trust client-submitted headers (X-Forwarded-For etc.) unless the proxy is trusted.
 */
import net from 'node:net';

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
  // Express trust-proxy must be enabled for req.ip to reflect X-Forwarded-For.
  const forwarded = req.ip || req.socket.remoteAddress || '';
  // Handle ::ffff:127.0.0.1 IPv4-mapped IPv6
  return forwarded.replace(/^::ffff:/, '');
}
