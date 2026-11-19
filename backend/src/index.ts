import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler } from './middleware/error';
import { apiRateLimit } from './middleware/rateLimiter';
import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import sessionRoutes from './routes/sessions';
import attendanceRoutes from './routes/attendance';
import reportRoutes from './routes/reports';
import networkRoutes from './routes/networks';
import auditRoutes from './routes/audit';
import { startDailySessionScheduler } from './lib/scheduler';

const app = express();

// Trust exactly one reverse proxy hop (Nginx) so req.ip reflects the real client IP.
// A boolean `true` is rejected by express-rate-limit as unsafe
// (ERR_ERL_PERMISSIVE_TRUST_PROXY), so use the hop count instead.
app.set('trust proxy', config.trustedProxy ? 1 : false);


app.use(helmet());
app.use(
  cors({
    // Reflect any origin from the allow-list (e.g. http://localhost and http://localhost:5173).
    // Requests without an Origin header (same-origin navigations, curl) are allowed.
    origin: (origin, callback) => {
      callback(null, !origin || config.corsOrigins.includes(origin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(apiRateLimit);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'mondaycheck-backend' }));

// Public runtime config (no secrets) — lets the UI show the canonical and fallback
// check-in links for a QR token.
app.get('/api/config', (_req, res) => {
  res.json({
    success: true,
    data: {
      frontendUrl: config.frontendUrl,
      publicIp: config.publicIp || null,
      wifiName: config.wifi.name,
      wifiPassword: config.wifi.password || null,
      wifiInstructions: config.wifi.instructions || null,
    },
  });
});


app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/networks', networkRoutes);
app.use('/api/audit', auditRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`MondayCheck backend listening on :${config.port} (${config.nodeEnv})`);
  startDailySessionScheduler();
});

export default app;