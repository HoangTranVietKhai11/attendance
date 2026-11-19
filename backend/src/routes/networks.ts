import { Router } from 'express';
import { z } from 'zod';
import net from 'node:net';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import { logAudit } from './audit';

const router = Router();

// A single host/CIDR (IPv4 or IPv6). Keep the allow-list narrow: IPv4 /8–/32,
// IPv6 /32–/128. This prevents accidentally opening the check-in to the Internet.
function isNetworkEntry(value: string): boolean {
  const [address, prefixRaw] = value.trim().split('/');
  const version = net.isIP(address);
  if (version === 0) return false;
  if (prefixRaw === undefined) return true;

  const bits = Number(prefixRaw);
  const maxBits = version === 4 ? 32 : 128;
  if (!Number.isInteger(bits) || bits < 0 || bits > maxBits) return false;
  return version === 4 ? bits >= 8 : bits >= 32;
}

const networkSchema = z.object({
  networkName: z.string().trim().min(1),
  publicIpOrCidr: z
    .string()
    .trim()
    .refine(isNetworkEntry, 'Use a single IP hoặc CIDR (VD 10.0.10.0/23, 2001:db8::/64)'),
  isActive: z.boolean().optional(),
});

const updateSchema = z
  .object({
    networkName: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.networkName !== undefined || data.isActive !== undefined, {
    message: 'Không có thay đổi nào để cập nhật',
  });

// List every DB range (including temporarily disabled ones) plus the static ranges
// declared in ALLOWED_NETWORKS so HR sees the full allow-list the server is using.
router.get('/', authenticate, async (_req, res) => {
  const networks = await prisma.allowedNetwork.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ success: true, data: { networks, env: config.allowedNetworks } });
});

router.post('/', authenticate, async (req, res) => {
  const data = networkSchema.parse(req.body);
  const cidr = data.publicIpOrCidr;

  if (config.allowedNetworks.includes(cidr)) {
    res.status(409).json({
      success: false,
      error: `Dải ${cidr} đã được khai báo trong ALLOWED_NETWORKS (.env), không cần thêm vào DB.`,
    });
    return;
  }

  const duplicate = await prisma.allowedNetwork.findFirst({ where: { publicIpOrCidr: cidr } });
  if (duplicate) {
    res.status(409).json({
      success: false,
      error: `Dải ${cidr} đã tồn tại (${duplicate.networkName}${duplicate.isActive ? '' : ' – đang tắt'}).`,
    });
    return;
  }

  const network = await prisma.allowedNetwork.create({
    data: { networkName: data.networkName, publicIpOrCidr: cidr, isActive: data.isActive ?? true },
  });
  await logAudit(
    req.admin!.id,
    'NETWORK_CREATE',
    network.id,
    `${network.networkName} · ${network.publicIpOrCidr}`
  );
  res.status(201).json({ success: true, data: network });
});

// Temporarily enable/disable a range (kept in DB so it can be re-enabled later) or rename it.
router.patch('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const data = updateSchema.parse(req.body);

  const existing = await prisma.allowedNetwork.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Không tìm thấy dải mạng.' });
    return;
  }

  const network = await prisma.allowedNetwork.update({ where: { id }, data });
  await logAudit(
    req.admin!.id,
    'NETWORK_UPDATE',
    network.id,
    `${network.networkName} · ${network.publicIpOrCidr} · ${network.isActive ? 'bật' : 'tắt'}`
  );
  res.json({ success: true, data: network });
});

router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.allowedNetwork.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Không tìm thấy dải mạng.' });
    return;
  }
  await prisma.allowedNetwork.delete({ where: { id } });
  await logAudit(
    req.admin!.id,
    'NETWORK_DELETE',
    existing.id,
    `${existing.networkName} · ${existing.publicIpOrCidr}`
  );
  res.json({ success: true, message: 'Network removed' });
});

export default router;