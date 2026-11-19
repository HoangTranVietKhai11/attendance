import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { admin: { select: { username: true } } },
  });
  res.json({ success: true, data: logs });
});

export async function logAudit(
  adminId: string,
  action: string,
  targetId?: string,
  details?: string
) {
  await prisma.auditLog.create({ data: { adminId, action, targetId, details } });
}

export default router;