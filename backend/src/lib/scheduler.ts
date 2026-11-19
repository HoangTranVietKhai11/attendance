import { prisma } from './prisma';
import { config } from '../config';
import { makeQrToken } from './qr';

/** Offset (ms) of `timeZone` at instant `d`, used to convert local wall-clock → UTC. */
function tzOffsetMs(d: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(d)) p[part.type] = part.value;
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), hour, Number(p.minute), Number(p.second));
  return asUtc - d.getTime();
}

/** Current local date (YYYY-MM-DD) and time (HH:mm) in the configured time zone. */
function localNow(timeZone: string): { date: string; time: string; minutes: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date())) p[part.type] = part.value;
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${String(hour).padStart(2, '0')}:${p.minute}`,
    minutes: hour * 60 + Number(p.minute),
  };
}

/** Convert a local wall-clock date+time in `timeZone` to a UTC Date. */
function localToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(guess - tzOffsetMs(new Date(guess), timeZone));
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Ensures one attendance session per day (created + opened at start time, closed after
 * end time). Because duplicate check-in is unique per session, this effectively resets
 * attendance every day.
 */
export async function runDailySessionTick(): Promise<string> {
  const cfg = config.autoSession;
  if (!cfg.enabled) return 'disabled';

  const tz = cfg.timeZone;
  const { date, minutes } = localNow(tz);
  const startMinutes = toMinutes(cfg.start);
  const endMinutes = toMinutes(cfg.end);

  const dayStart = localToUtc(date, '00:00', tz);
  const dayEnd = localToUtc(date, '23:59', tz);
  const existing = await prisma.attendanceSession.findFirst({
    where: { sessionName: cfg.name, sessionDate: { gte: dayStart, lte: dayEnd } },
    orderBy: { createdAt: 'desc' },
  });

  // Close a session whose window has passed.
  if (existing) {
    if (existing.status === 'ACTIVE' && minutes > endMinutes) {
      await prisma.attendanceSession.update({ where: { id: existing.id }, data: { status: 'CLOSED' } });
      return 'closed';
    }
    if (existing.status === 'SCHEDULED' && minutes >= startMinutes) {
      await prisma.attendanceSession.update({ where: { id: existing.id }, data: { status: 'ACTIVE' } });
      return 'opened';
    }
    return 'noop';
  }

  if (minutes < startMinutes) return 'waiting';

  // No session today and we are inside the window → create and open it.
  // createdBy is a required FK, so an admin must exist (seed creates "hr").
  const admin = await prisma.adminUser.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!admin) return 'no-admin';
  const { token, hash } = makeQrToken();
  await prisma.attendanceSession.create({
    data: {
      sessionName: cfg.name,
      sessionDate: localToUtc(date, '00:00', tz),
      startTime: localToUtc(date, cfg.start, tz),
      endTime: localToUtc(date, cfg.end, tz),
      status: 'ACTIVE',
      qrTokenHash: hash,
      qrToken: token,
      createdBy: admin.id,
    },
  });
  return 'created';
}

export function startDailySessionScheduler(): void {
  if (!config.autoSession.enabled) return;
  const tick = () => {
    runDailySessionTick().catch((e) => {
      // eslint-disable-next-line no-console
      console.error('auto-session tick failed:', e);
    });
  };
  tick();
  setInterval(tick, 60 * 1000);
  // eslint-disable-next-line no-console
  console.log(
    `Daily session scheduler on: "${config.autoSession.name}" ${config.autoSession.start}-${config.autoSession.end} (${config.autoSession.timeZone})`
  );
}
