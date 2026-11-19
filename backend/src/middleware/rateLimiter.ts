import rateLimit from 'express-rate-limit';

// Behind Docker Desktop (Windows) every LAN client appears as the docker gateway IP,
// so the per-IP limit is shared by all phones. Keep both limits configurable.
const checkinMax = Number(process.env.CHECKIN_RATE_LIMIT_MAX || 10);
const apiMax = Number(process.env.API_RATE_LIMIT_MAX || 120);

/** Strict rate limit for public attendance check-in endpoints. */
export const checkinRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: checkinMax, // max check-in attempts per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

/** General rate limit for authenticated admin APIs. */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});