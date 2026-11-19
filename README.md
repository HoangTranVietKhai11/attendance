# MondayCheck – Employee Attendance System

Modern, lightweight, responsive web application for internal employee attendance management. HR manages weekly attendance every Monday; employees scan a QR Code and submit attendance from the company Wi-Fi.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + React Router |
| Backend | Node.js + Express.js + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Validation | Zod |
| Auth | JWT + bcryptjs password hashing |
| QR Code | `qrcode` library |
| Excel export/import | ExcelJS |
| Rate limiting | express-rate-limit |
| Security | helmet, cors, trusted proxy |
| Deployment | Docker / Docker Compose, Nginx reverse proxy, HTTPS |

## Project Structure

```
QR_checkin_checkout/
├── backend/                 # Express + TypeScript + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Seed admin user + default networks
│   ├── src/
│   │   ├── config.ts        # Environment configuration
│   │   ├── lib/
│   │   │   ├── prisma.ts    # Prisma singleton client
│   │   │   ├── ip.ts        # Client IP extraction + CIDR matching
│   │   │   └── qrcode.d.ts  # qrcode type declaration
│   │   ├── middleware/
│   │   │   ├── auth.ts      # JWT authentication
│   │   │   ├── error.ts     # Centralized error handler
│   │   │   └── rateLimiter.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── employees.ts
│   │   │   ├── sessions.ts
│   │   │   ├── attendance.ts
│   │   │   ├── reports.ts
│   │   │   └── networks.ts
│   │   └── index.ts         # App entry point
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                 # (create from .env.example)
│   └── .env.example
├── frontend/                # React + Vite + TypeScript SPA
│   ├── src/
│   │   ├── lib/api.ts       # API client (attach Bearer token from localStorage)
│   │   ├── index.css        # Tailwind + design tokens
│   │   ├── App.tsx          # Router + protected routes
│   │   ├── main.tsx
│   │   └── pages/           # Login, Dashboard, Sessions, SessionDetail, Employees, Reports, CheckIn
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                 # (create from .env.example)
├── nginx/
│   └── nginx.conf           # Reverse proxy (HTTP + optional HTTPS)
├── docker-compose.yml
├── .env.example             # Root-level example env
└── Danh_Sach_Nhan_Su_18_Group_Mail.xlsx  # Employee source data
```

## Database Schema

Core models (see `backend/prisma/schema.prisma`):

- **employees** – id, employee_code (unique), full_name, department, email, position, is_active, created_at
- **attendance_sessions** – id, session_name, session_date, qr_token_hash (unique), start_time, end_time, status (SCHEDULED/ACTIVE/CLOSED), created_by, created_at
- **attendance_records** – id, session_id, employee_id, check_in_time, client_ip, created_at; unique constraint `(session_id, employee_id)` prevents duplicates
- **admin_users** – id, username (unique), password_hash, role, created_at
- **audit_logs** – id, admin_id, action, target_id, details, created_at
- **allowed_networks** – id, network_name, public_ip_or_cidr, is_active, created_at

## API Endpoints

### Auth
- `POST /api/auth/login` – HR login → `{ token, user }`
- `GET /api/auth/me` – current admin (requires Bearer token)

### Employees (auth)
- `GET /api/employees?q=` – list/search
- `POST /api/employees` – create
- `PATCH /api/employees/:id` – update
- `DELETE /api/employees/:id` – deactivate (set is_active=false)
- `POST /api/employees/import` – import from Excel/CSV (`{ fileName, contentBase64 }`)

### Sessions (auth)
- `GET /api/sessions` – list
- `POST /api/sessions` – create (returns `qrToken` once + `qrUrl`)
- `GET /api/sessions/:id` – detail + records
- `GET /api/sessions/:id/verify?t=` – public: verify QR token & active status
- `GET /api/sessions/:id/qr?t=` – auth: QR PNG image (token must match session hash)
- `PATCH /api/sessions/:id/start` – open session
- `PATCH /api/sessions/:id/close` – close/expire session

### Attendance (public, rate-limited)
- `GET /api/attendance/my-ip` – current client IP, `allowed` flag, required Wi-Fi name
- `POST /api/attendance/checkin` – `{ token, employeeCode, fullName }`

### Networks (auth)
- `GET /api/networks` – `{ networks, env }` (DB ranges + static `ALLOWED_NETWORKS`)
- `POST /api/networks` – add a single IP or CIDR (duplicates are rejected)
- `PATCH /api/networks/:id` – rename or enable/disable a range
- `DELETE /api/networks/:id` – remove a range

### Audit (auth)
- `GET /api/audit` – latest 200 admin actions (includes network add/enable/disable/delete)

## Security Model

1. **Network restriction (critical):** Attendance accepts requests only from IPs/CIDRs in `ALLOWED_NETWORKS`. The real client IP is extracted via Express `trust proxy` (honors X-Forwarded-For from Nginx/Cloudflare). Client-submitted IP headers are never trusted.
2. **Duplicate prevention:** DB unique constraint on `(session_id, employee_id)`, plus atomic transaction check-then-insert and P2002 constraint guard for concurrent submissions.
3. **QR security:** QR token is random (24 bytes hex). Only its SHA-256 hash is stored (`qr_token_hash`); the plain token is shown to HR once at session creation and never stored/re-exposed. QR URL contains only the token (no employee data). Session expiration via status=CLOSED and time window.
4. **Authentication:** JWT with bcryptjs password hashing. Protected admin routes require valid Bearer token. Password comparison constant-time.
5. **Input validation:** Zod schemas on all request bodies. Parameterized Prisma queries → SQL injection protection.
6. **Rate limiting:** Strict limit on `/api/attendance/checkin`; general limit on admin APIs.
7. **Audit logging:** HR administrative actions recorded in `audit_logs`.
8. **HTTPS:** Enforce via Nginx in production; `TRUSTED_PROXY=true` so `req.ip` reflects the real client behind the proxy.

- `POST /api/attendance/checkin` – `{ token, employeeCode, fullName }` → success / duplicate / network error
- `GET /api/attendance/session/:id/records` – records for a session

### Reports (auth)
- `GET /api/reports/export?sessionId=` – Excel export

### Networks (auth)
- `GET /api/networks` – active allowed networks
- `POST /api/networks` – add network
- `DELETE /api/networks/:id` – remove


## Installation & Setup (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL (local or Docker)
- npm

### 1. Backend
```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL, JWT_SECRET, ALLOWED_NETWORKS, ADMIN credentials
npm install
npx prisma generate
npx prisma db push        # create tables in PostgreSQL
npx tsx prisma/seed.ts    # seed default admin (hr/Admin@123) + networks
npm run dev               # http://localhost:4000
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env   # VITE_API_BASE=http://localhost:4000
npm install
npm run dev            # http://localhost:5173
```

Login as HR: `hr` / `Admin@123` (change after first login).

## Employee Import from Excel

The file `Danh_Sach_Nhan_Su_18_Group_Mail.xlsx` contains employee data on sheet **"Chi Tiết Nhân Sự Chuẩn HCNS"** with columns:
`Tên Group`, `Email Group`, `Mã NV`, `Họ và tên`, `Email chính thức`, `Phòng ban`, `Vị trí công tác`, `Trạng thái`.

To import:
1. HR → Employees → "Nhập từ Excel/CSV"
2. Select the `.xlsx` file
3. The backend maps `Mã NV` → employee_code, `Họ và tên` → full_name, `Phòng ban` → department, `Email chính thức` → email, `Vị trí công tác` → position, `Trạng thái` → is_active (contains "Đang làm" → active).


## Network Restriction Configuration

Check-in is accepted only from IPs inside the company Wi-Fi. The allow-list is the **union of two sources**:

1. `ALLOWED_NETWORKS` in `.env` — static, change requires restarting the backend.
2. Active rows in the `allowed_networks` table — managed by HR at **Wi-Fi** (`/networks`), effective immediately.

```ini
ALLOWED_NETWORKS=127.0.0.1,::1,10.0.10.0/23

# Shown to employees when their IP is outside the allow-list (4G/5G or another Wi-Fi)
WIFI_NAME=#P.DAOTAO_DDV GROUP
WIFI_PASSWORD=...
WIFI_INSTRUCTIONS=Tắt 4G/5G, kết nối đúng Wi-Fi công ty rồi bấm "Kiểm tra lại".
```

- Use a single IP or CIDR `/8`–`/32`; anything wider than `/8` is rejected so the list can never become "the whole internet".
- The **Wi-Fi** page shows the IP the server sees (`/api/attendance/my-ip`), lets HR add a `/32` or `/24`, and temporarily disable (not delete) a range.
- Employees outside the allow-list get HTTP 403 with the required SSID/password; after joining they tap "Kiểm tra lại".
- Behind Nginx/Cloudflare set `TRUSTED_PROXY=true`. Nginx overwrites `X-Forwarded-For`, so a client cannot spoof its IP.
- Windows + Docker Desktop NATs every client to 172.x — add `172.16.0.0/12` for local testing only, remove it in production.

## Docker Deployment (Production)

```bash
# 1. Copy env examples
cp .env.example .env
cp backend/.env.example backend/.env

# 2. Edit .env with production values (strong JWT_SECRET/ADMIN_PASSWORD/DB password, real ALLOWED_NETWORKS)
#    FRONTEND_URL must be the address employees can reach (e.g. http://192.168.1.50 or the
#    public domain) — QR/check-in links are generated from it, so never use "localhost"
#    if phones scan the QR code. Tip: use the wildcard DNS form http://<lan-ip>.nip.io
#    (or .sslip.io) so Android/iOS QR scanners show an "Open link" button instead of
#    only "Copy" (scanners often refuse bare private-IP URLs).
#    ALLOWED_NETWORKS: on Windows + Docker Desktop every LAN client is NAT'ed to the docker
#    gateway (172.x), so add 172.16.0.0/12 for local testing only — remove it on a Linux
#    server, where the real client IP is preserved and the Wi-Fi lock stays strict.

# 3. HTTPS: có IP public → DEPLOYMENT.md §5 (certbot + nginx.prod.conf);
#    không có IP public → Cloudflare Tunnel (§5b, nginx/nginx.tunnel.conf)

# 4. Build & run
docker compose up -d --build

# 5. Initialize database (run once)
docker compose exec backend npx prisma db push
docker compose exec backend npx tsx prisma/seed.ts
```

Services:
- `postgres:5432` – database
- `backend:4000` – API
- `frontend:80` – web app
- `nginx:80/443` – reverse proxy

Access the app at `http://localhost` (or `https://` with certs).

### Nginx / HTTPS

See `nginx/nginx.conf`. The HTTP server proxies `/api/` to backend and `/` to frontend (SPA fallback). For production, obtain certificates (e.g. Let's Encrypt), place them in `./nginx/certs/`, and uncomment the HTTPS server block to enforce HTTPS.

## Available Scripts

Backend (`backend/`):
- `npm run dev` – dev server with tsx watch
- `npm run build` – TypeScript compile
- `npm start` – run compiled dist
- `npx prisma generate` – generate Prisma client
- `npx prisma db push` – push schema to DB
- `npx tsx prisma/seed.ts` – seed admin + networks

Frontend (`frontend/`):
- `npm run dev` – Vite dev server (proxy /api → :4000)
- `npm run build` – type-check + Vite production build
- `npm run lint` – TypeScript noEmit check

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| HR / Admin | `hr` | `Admin@123` |

Change these immediately after first login.

## Development Roadmap (per project spec)

- Phase 1 – Core: HR login, employee management, sessions, QR generation, employee check-in, duplicate prevention. ✅
- Phase 2 – Network Security: IP whitelist, backend network verification, session expiration, rate limiting. ✅
- Phase 3 – HR Dashboard: live attendance, statistics, search/filter, Excel export. ✅
- Phase 4 – Production: Docker, Nginx, HTTPS, DB backup, logging/monitoring. ✅ (Dockerfiles + docker-compose + nginx provided)

