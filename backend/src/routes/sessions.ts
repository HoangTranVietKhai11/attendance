import { Router, type Request } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import { makeQrToken, hashToken } from '../lib/qr';
import { requestBaseUrl, isLoopbackUrl } from '../lib/publicUrl';

const router = Router();

/** Check-in URL encoded into a session's QR code. */
function checkinUrl(req: Request, token: string): string {
  return `${requestBaseUrl(req)}/checkin?t=${token}`;
}

/** QR image (data URL) so the UI never has to read a cached image of an old token. */
async function qrImage(url: string): Promise<string> {
  // Default quiet zone (4 modules) keeps the code scannable from a screen/TV.
  return QRCode.toDataURL(url, { width: 480 });
}

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
  const qrUrl = checkinUrl(req, token);
  res.status(201).json({
    success: true,
    data: { ...session, qrToken: token, qrUrl, qrDataUrl: await qrImage(qrUrl) },
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
    res.status(404).json({
      success: false,
      error:
        'Mã QR không hợp lệ hoặc đã được thay bằng mã mới. Hãy quét lại mã QR đang hiển thị trên màn hình.',
    });
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
// `Cache-Control: no-store` keeps a rotated token from being masked by a cached image.
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
  const url = checkinUrl(req, token);
  const png = await QRCode.toDataURL(url);
  res.set('Cache-Control', 'no-store, max-age=0');
  res.type('png').send(Buffer.from(png.split(',')[1], 'base64'));
});

// Check-in links (canonical domain + plain-IP fallback) plus the rendered QR image for
// the session's token. One request is enough to display the QR, and the base64 image
// cannot be stale (no browser caching of the image endpoint involved).
router.get('/:id/links', authenticate, async (req, res) => {
  const session = await prisma.attendanceSession.findUnique({ where: { id: req.params.id } });
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }
  const token = session.qrToken;
  if (!token) {
    res.json({
      success: true,
      data: { token: null, url: null, fallbackUrl: null, qrDataUrl: null, reachable: false },
    });
    return;
  }
  const url = checkinUrl(req, token);
  res.json({
    success: true,
    data: {
      token,
      url,
      fallbackUrl: config.publicIp ? `http://${config.publicIp}/checkin?t=${token}` : null,
      qrDataUrl: await qrImage(url),
      // false → the link points at localhost, a phone will report "not found".
      reachable: !isLoopbackUrl(url),
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
  const qrUrl = checkinUrl(req, token);
  res.json({
    success: true,
    data: { token, qrUrl, qrDataUrl: await qrImage(qrUrl), reachable: !isLoopbackUrl(qrUrl) },
  });
});

export default router;