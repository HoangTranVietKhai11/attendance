Đang làm / tiếp theo / blocker:
- Xong: backend (Express+TS+Prisma) + frontend (React+Vite+Tailwind) MondayCheck; Docker stack postgres/backend/frontend/nginx chạy end-to-end.
- Xong E2E (local): login → employees (import Excel 253 NV) → session → start → QR → check-in (chặn ngoài LAN 403, trùng 400) → records → export xlsx → close.
- Xong hạ tầng: SPA fallback, `/api` same-origin, trust proxy 1, QR token lưu DB + link dự phòng IP, allow-list = `.env` ∪ bảng `allowed_networks`, trang Wi-Fi, IPv6 CIDR.
- Xong deploy VPS (19/11): SSH key `mondaycheck_vps` OK (`ssh mondaycheck`, dev + sudo + docker), Ubuntu 24.04 LXC/Proxmox, Docker 29.1.3 + Compose 2.40.3, code ở `~/mondaycheck`, 4 container healthy, `prisma db push` + seed admin `hr`.
- Xong smoke test trên VPS: **16/16 PASS** — login, me, import 253 NV, tạo/mở phiên, rotate QR, check-in 200, trùng 400, records=1, close → QR hết hiệu lực, check-in 403 đúng thông báo Wi-Fi, export xlsx 200 (cần `?sessionId=`).
- Tiếp theo: cần **token Cloudflare Named Tunnel + domain** (repo đã có `--profile tunnel` + `nginx.tunnel.conf`) hoặc nhà cung cấp NAT 80/443 → 192.168.100.6; sau đó đặt `FRONTEND_URL`/`CORS_ORIGINS` = domain HTTPS.
- Cần xác nhận: IP public Wi-Fi công ty thật (đang tạm 14.226.248.148/32), `WIFI_NAME`/`WIFI_PASSWORD`, mật khẩu sudo của `dev` (chỉ cần cho timezone/ufw/certbot).
- Blocker: VPS không có inbound public (100.103.205.56 là IP Tailscale; IP public 115.73.223.192 đóng 80/443) → chưa thể cho điện thoại 4G truy cập.
- Mật khẩu admin hiện tại: `hr` / `Mc@2026Hr!` (chưa có trang đổi mật khẩu — đổi qua DB nếu cần).
