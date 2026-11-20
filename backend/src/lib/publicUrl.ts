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
 * The backend and frontend are separate Render services in production. Therefore the
 * QR must always use the configured frontend URL; using the request Host would encode
 * `attendance-v5v6.onrender.com/checkin`, which is a backend route and returns 404.
 */
export function requestBaseUrl(req: Request): string {
  const configured = (config.frontendUrl || '').trim().replace(/\/+$/, '');
  return configured || 'http://localhost:5173';
}
