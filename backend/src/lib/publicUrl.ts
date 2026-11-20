import type { Request } from 'express';
import { config } from '../config';

/** Hostname of an absolute URL, or '' when the value is not a valid URL. */
function hostOf(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

/** Strip the `:port` part of a Host header value. */
function bareHost(host: string): string {
  return host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
}

/** True for hosts that only exist on the machine that generated the QR. */
export function isLoopbackHost(host: string): boolean {
  const h = bareHost(host).toLowerCase();
  return h === 'localhost' || h === '::1' || h === '0.0.0.0' || /^127\./.test(h);
}

/** True when the URL points at localhost — a phone can never open such a link. */
export function isLoopbackUrl(url: string): boolean {
  return isLoopbackHost(hostOf(url));
}

/**
 * Base URL (no trailing slash) that employees' phones must open after scanning the QR.
 *
 * The Host header of the current request is used: whatever address HR opened the
 * dashboard with is reachable from the office network (LAN IP, `<ip>.nip.io`, Cloudflare
 * tunnel, public domain…) and never goes stale when the server IP/domain changes.
 *
 * `FRONTEND_URL` is only used as a fallback when the request itself comes from loopback
 * (HR debugging on the server at http://localhost) but a reachable public URL is
 * configured. Previously every QR was built from the static env value, so a stale
 * `http://localhost:5173` produced QR codes that phones could not open ("not found").
 */
export function requestBaseUrl(req: Request): string {
  const configured = (config.frontendUrl || '').trim().replace(/\/+$/, '');
  const host = req.get('host');

  if (!host) return configured || 'http://localhost';

  if (isLoopbackHost(host) && configured && !isLoopbackUrl(configured)) {
    return configured;
  }

  const proto =
    (req.get('x-forwarded-proto') || '').split(',')[0].trim() || req.protocol || 'http';
  return `${proto}://${host}`;
}
