import { prisma } from './prisma';
import { config } from '../config';

/**
 * Allowed networks come from two places:
 *  - ALLOWED_NETWORKS in .env (source of truth for infrastructure-as-code)
 *  - active rows in `allowed_networks` (managed by HR at runtime via /api/networks)
 * The union is used for every check-in, so a new office Wi-Fi can be added without a redeploy.
 */
export async function effectiveAllowedNetworks(): Promise<string[]> {
  const envList = [...config.allowedNetworks];
  // In production, the Render environment variable is the single source of truth.
  // Do not let old networks left in the local/admin database silently reopen access.
  if (config.nodeEnv === 'production') {
    return envList.filter((entry) => !['127.0.0.1', '127.0.0.1/32', '::1', '::1/128'].includes(entry));
  }
  try {
    const dbNetworks = await prisma.allowedNetwork.findMany({
      where: { isActive: true },
      select: { publicIpOrCidr: true },
    });
    const dbList = dbNetworks.map((n) => n.publicIpOrCidr.trim()).filter(Boolean);
    const combined = Array.from(new Set([...envList, ...dbList]));

    // Render/VPS production must never allow loopback. Seed data contains loopback
    // entries for local smoke tests; keeping them active would allow every request
    // that arrives through a proxy as ::1 when TRUSTED_PROXY is misconfigured.
    return combined;
  } catch {
    // DB unavailable → fall back to env so the check-in path keeps working.
    return envList;
  }
}
