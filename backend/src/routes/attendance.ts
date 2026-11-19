import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { isIpAllowed, clientIp } from '../lib/ip';
import { effectiveAllowedNetworks } from '../lib/networks';
import { checkinRateLimit } from '../middleware/rateLimiter';
import { config } from '../config';

const router = Router();

const checkinSchema = z.object({
  token: z.string().min(1),
  employeeCode: z.string().min(1),
  fullName: z.string().min(1),
});

const NETWORK_ERROR = `Chỉ có thể điểm danh khi kết nối Wi-Fi "${config.wifi.name}". Vui lòng tắt 4G/5G và kết nối đúng Wi-Fi này rồi thử lại.`;

// Public helper: returns the client IP as seen by the server and whether it may check in.
// Used by employees/HR to identify the office Wi-Fi subnet before adding it to the allow-list.
router.get('/my-ip', async (req, res) => {
  const ip = clientIp(req);
  const allowedNetworks = await effectiveAllowedNetworks();
  res.json({
    success: true,
    data: {
      ip,
      allowed: isIpAllowed(ip, allowedNetworks),
      wifiName: config.wifi.name,
    },
  });
});

// Rate-limit only the write action: `my-ip` is a read-only diagnostic call that the
// Wi-Fi admin page refreshes after every change, so it must not consume the check-in quota.
router.post('/checkin', checkinRateLimit, async (req, res) => {
  const { token, employeeCode, fullName } = checkinSchema.parse(req.body);

  // 1. Network restriction: verify actual client IP (never trust client-submitted IP)
  const ip = clientIp(req);
  const allowedNetworks = await effectiveAllowedNetworks();
  if (!isIpAllowed(ip, allowedNetworks)) {
    res.status(403).json({ success: false, error: NETWORK_ERROR });
    return;
  }

  // 2. Resolve session from token hash (token never stored in plaintext)
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await prisma.attendanceSession.findUnique({
    where: { qrTokenHash: hash },
    include: { records: true },
  });
  if (!session) {
    res.status(404).json({ success: false, error: 'Invalid or expired QR code' });
    return;
  }

  // 3. Session must be active and within time window
  const now = new Date();
  if (
    session.status !== 'ACTIVE' ||
    now < new Date(session.startTime) ||
    now > new Date(session.endTime)
  ) {
    res.status(400).json({ success: false, error: 'Attendance session is not active at this time.' });
    return;
  }

  // 4. Validate employee against database.
  // Employee codes are stored without leading zeros ("5186"), but people often type
  // "05186" — try the raw code plus normalised variants before giving up.
  const rawCode = employeeCode.trim();
  const stripped = rawCode.replace(/^0+(?=\d)/, '');
  const variants = Array.from(
    new Set([rawCode, stripped, stripped.padStart(4, '0'), stripped.padStart(5, '0')])
  );
  const employee = await prisma.employee.findFirst({
    where: { employeeCode: { in: variants } },
  });
  if (!employee) {
    res.status(400).json({
      success: false,
      error: `Employee code "${rawCode}" was not found. Please check the code and try again.`,
    });
    return;
  }
  if (!employee.isActive) {
    res.status(400).json({
      success: false,
      error: 'This employee is inactive and cannot check in.',
    });
    return;
  }

  // 5. Duplicate prevention at DB level (atomic insert inside transaction)
  try {
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceRecord.findFirst({
        where: { sessionId: session.id, employeeId: employee.id },
      });
      if (existing) {
        const err: any = new Error('DUPLICATE');
        err.statusCode = 400;
        throw err;
      }
      return tx.attendanceRecord.create({
        data: {
          sessionId: session.id,
          employeeId: employee.id,
          clientIp: ip,
        },
        include: { employee: true },
      });
    });
    res.json({
      success: true,
      message: 'Attendance successful!',
      data: {
        employeeCode: record.employee.employeeCode,
        fullName: record.employee.fullName,
        checkInTime: record.checkInTime,
        session: session.sessionName,
      },
    });
  } catch (err: any) {
    if (err.message === 'DUPLICATE') {
      res.status(400).json({
        success: false,
        error: 'You have already completed your attendance for this session.',
      });
      return;
    }
    // DB unique constraint guard for simultaneous submissions
    if (err.code === 'P2002') {
      res.status(400).json({
        success: false,
        error: 'You have already completed your attendance for this session.',
      });
      return;
    }
    throw err;
  }
});

// HR: list attendance records for a session
router.get('/session/:id/records', async (req, res) => {
  const { id } = req.params;
  const records = await prisma.attendanceRecord.findMany({
    where: { sessionId: id },
    include: { employee: true },
    orderBy: { checkInTime: 'desc' },
  });
  res.json({ success: true, data: records });
});

export default router;