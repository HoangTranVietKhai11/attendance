import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { authenticate } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }
  const token = (jwt as any).sign(
    { id: admin.id, username: admin.username, role: admin.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  ) as string;
  res.json({
    success: true,
    data: { token, user: { id: admin.id, username: admin.username, role: admin.role } },
  });
});

router.get('/me', authenticate, async (req, res) => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: req.admin!.id },
    select: { id: true, username: true, role: true, createdAt: true },
  });
  res.json({ success: true, data: admin });
});

export default router;