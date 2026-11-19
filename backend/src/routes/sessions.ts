import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import { makeQrToken, hashToken } from '../lib/qr';

const router = Router();

const sessionSchema = z.object({
  sessionName: z.string().min(1),
  sessionDate: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

// Generate a random unguessable session token and its hash (see lib/qr.ts)

// List sessions
router.get('/', authenticate, async (req, res) => {
  const sessions = await prisma.attendanceSession.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, sessionName: true, sessionDate: true, startTime: true, endTime: true,
      status: true, createdAt: true,
      _count: { select: { records: true } },
    },
  });
  res.json({ success: true, data: sessions });
});

// Create a new session. Returns the plain QR token once (shown to HR) and its hash (stored).
router.post('/', authenticate, async (req, res) => {
  const data = sessionSchema.parse(req.body);
  const { token, hash } = makeQrToken();
  const session = await prisma.attendanceSession.create({
    data: {
      sessionName: data.sessionName,
      sessionDate: new Date(data.sessionDate),
      qrTokenHash: hash,
      qrToken: token,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      status: 'SCHEDULED',
      createdBy: req.admin!.id,
    },
  });
  const qrUrl = `${config.frontendUrl}/checkin?t=${token}`;
  res.status(201).json({
    success: true,
    data: { ...session, qrToken: token, qrUrl },
  });
});

// Verify a QR token (public, used by check-in page to load session info).
// NOTE: must be declared before GET /:id, otherwise "verify" is captured as an :id param.
router.get('/verify', async (req, res) => {
  const { t } = req.query as { t?: string };
  if (!t) {
    res.status(400).json({ success: false, error: 'Missing token' });
    return;
  }
  const hash = hashToken(t);
  const session = await prisma.attendanceSession.findUnique({
    where: { qrTokenHash: hash },
    select: { id: true, sessionName: true, sessionDate: true, startTime: true, endTime: true, status: true },
  });
  if (!session) {
    res.status(404).json({ success: false, error: 'Invalid or expired QR code' });
    return;
  }
  const now = new Date();
  const active =
    session.status === 'ACTIVE' &&
    now >= new Date(session.startTime) &&
    now <= new Date(session.endTime);
  res.json({ success: true, data: { ...session, checkInAllowed: active } });
});

// Get session detail (never exposes the raw token or its hash)
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const session = await prisma.attendanceSession.findUnique({
    where: { id },
    include: {
      records: {
        include: { employee: true },
        orderBy: { checkInTime: 'desc' },
      },
    },
  });
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  res.json({ success: true, data: session });
});

// QR code image for a session. HR only — the token is taken from the stored session,
// so the QR can be re-opened any time from any device (an explicit `t` is still accepted).
router.get('/:id/qr', authenticate, async (req, res) => {
  const { id } = req.params;
  const { t } = req.query as { t?: string };
  const session = await prisma.attendanceSession.findUnique({ where: { id } });
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  const token = t || session.qrToken;
  if (!token || !session.qrTokenHash) {
    res.status(400).json({ success: false, error: 'This session has no QR yet. Generate one first.' });
    return;
  }
  if (hashToken(token) !== session.qrTokenHash) {
    res.status(403).json({ success: false, error: 'Invalid token for this session' });
    return;
  }
  const url = `${config.frontendUrl}/checkin?t=${token}`;
  const png = await QRCode.toDataURL(url);
  res.type('png').send(Buffer.from(png.split(',')[1], 'base64'));
});

// Check-in links (canonical domain + plain-IP fallback) for the session's QR token.
router.get('/:id/links', authenticate, async (req, res) => {
  const session = await prisma.attendanceSession.findUnique({ where: { id: req.params.id } });
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  const token = session.qrToken;
  if (!token) {
    res.json({ success: true, data: { token: null, url: null, fallbackUrl: null } });
    return;
  }
  res.json({
    success: true,
    data: {
      token,
      url: `${config.frontendUrl}/checkin?t=${token}`,
      fallbackUrl: config.publicIp ? `http://${config.publicIp}/checkin?t=${token}` : null,
    },
  });
});

// Start session
router.patch('/:id/start', authenticate, async (req, res) => {
  const { id } = req.params;
  const session = await prisma.attendanceSession.update({
    where: { id },
    data: { status: 'ACTIVE' },
  });
  res.json({ success: true, data: session });
});

// Close session (expires QR)
router.patch('/:id/close', authenticate, async (req, res) => {
  const { id } = req.params;
  const session = await prisma.attendanceSession.update({
    where: { id },
    data: { status: 'CLOSED' },
  });
  res.json({ success: true, data: session });
});

// Issue/rotate the QR token for a session. Used for auto-created daily sessions
// (the token is only ever shown to the logged-in HR once) or to revoke a leaked QR.
router.post('/:id/rotate-qr', authenticate, async (req, res) => {
  const { id } = req.params;
  const session = await prisma.attendanceSession.findUnique({ where: { id } });
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  const { token, hash } = makeQrToken();
  await prisma.attendanceSession.update({
    where: { id },
    data: { qrTokenHash: hash, qrToken: token },
  });
  res.json({
    success: true,
    data: { token, qrUrl: `${config.frontendUrl}/checkin?t=${token}` },
  });
});

export default router;