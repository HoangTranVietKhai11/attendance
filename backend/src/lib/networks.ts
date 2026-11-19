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
  try {
    const dbNetworks = await prisma.allowedNetwork.findMany({
      where: { isActive: true },
      select: { publicIpOrCidr: true },
    });
    const dbList = dbNetworks.map((n) => n.publicIpOrCidr.trim()).filter(Boolean);
    return Array.from(new Set([...envList, ...dbList]));
  } catch {
    // DB unavailable → fall back to env so the check-in path keeps working.
    return envList;
  }
}
