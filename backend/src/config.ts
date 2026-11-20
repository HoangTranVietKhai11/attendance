import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  allowedNetworks: (process.env.ALLOWED_NETWORKS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  frontendUrl: process.env.FRONTEND_URL || 'https://mondaycheck.onrender.com',
  // Plain LAN IP of this server, used to render a fallback check-in link
  // (some Android scanners / DNS setups cannot open the <ip>.nip.io domain).
  publicIp: process.env.PUBLIC_IP || '',
  // Comma-separated list of origins allowed by CORS (defaults to FRONTEND_URL).
  corsOrigins: (
    process.env.CORS_ORIGINS ||
    `${process.env.FRONTEND_URL || 'https://mondaycheck.onrender.com'},http://localhost:5173`
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustedProxy: process.env.TRUSTED_PROXY === 'true',
  // Wi-Fi employees must use to check in (shown to them when they are on 4G/5G/other Wi-Fi).
  wifi: {
    name: process.env.WIFI_NAME || 'Wi-Fi công ty',
    password: process.env.WIFI_PASSWORD || '',
    instructions: process.env.WIFI_INSTRUCTIONS || '',
  },
  // Optional daily attendance session, so check-in "resets" every day without manual work.
  autoSession: {
    enabled: process.env.AUTO_SESSION_ENABLED === 'true',
    name: process.env.AUTO_SESSION_NAME || 'Sinh hoạt đầu giờ',
    start: process.env.AUTO_SESSION_START || '08:00',
    end: process.env.AUTO_SESSION_END || '11:00',
    timeZone: process.env.AUTO_SESSION_TIMEZONE || 'Asia/Ho_Chi_Minh',
  },
} as const;

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env variable: ${key}`);
  }
  return value;
}