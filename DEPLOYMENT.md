# MondayCheck — Hướng dẫn triển khai (Production)

## 0. Nguyên tắc quan trọng nhất: lấy được IP thật của nhân viên
Chức năng "chỉ điểm danh trong Wi-Fi công ty" hoạt động bằng cách so IP client với danh sách `IP/CIDR`.

- **Deploy trên Linux** (máy chủ/VM trong LAN): nginx nhận IP thật của điện thoại → `X-Forwarded-For` đúng → chốt Wi-Fi hoạt động chính xác.
- **KHÔNG dùng Docker Desktop trên Windows cho production**: Docker Desktop NAT mọi client thành IP gateway `172.x`, nên mọi người (kể cả ngoài công ty) đều lọt qua. Chỉ dùng cho dev.

## 0b. Deploy public: VPS + domain + HTTPS (mô hình đang chọn)
Khác với máy chủ trong LAN ở chỗ **VPS nhìn thấy IP public của đường internet công ty**, không phải `10.x`:

1. Trỏ bản ghi DNS `A` của domain (VD `chamcong.congty.vn`) về **IP public của VPS**; mở inbound TCP 80/443.
2. Trên điện thoại đang kết nối **Wi-Fi công ty**, mở `https://api.ipify.org` → ghi lại IP public
   (mọi điện thoại trong Wi-Fi công ty dùng chung IP này khi ra internet).
3. Thêm IP đó dạng `/32` vào `ALLOWED_NETWORKS` (nhiều đường WAN/AP thì thêm tất cả).
4. Đặt `FRONTEND_URL=https://chamcong.congty.vn`, `CORS_ORIGINS=https://chamcong.congty.vn`, `PUBLIC_IP=` (để trống).
5. Đổi `JWT_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD` **trước khi seed**.
6. Làm HTTPS theo mục 5. Sau đó kiểm tra: Wi-Fi công ty → điểm danh được; 4G → 403.

## 0c. Chọn mô hình triển khai

| Mô hình | Chi phí | Phù hợp | Lưu ý |
|---|---:|---|---|
| Máy local + IP LAN | Miễn phí | Test trong cùng mạng | Điện thoại phải truy cập được IP máy chủ; không dùng được khi máy tắt hoặc khác mạng |
| Máy local + Cloudflare Named Tunnel | Miễn phí (ngoài chi phí domain nếu có) | Nhóm nhỏ, public nhanh | Máy local phải luôn bật; dùng domain cố định và `nginx.tunnel.conf` |
| Oracle Cloud Always Free | Có thể miễn phí | Chạy liên tục không phụ thuộc máy cá nhân | Phải tự quản trị VM, firewall, backup; tài nguyên/khả dụng phụ thuộc chính sách nhà cung cấp |
| VPS + domain + HTTPS | Có phí VPS | Production ổn định | Có IP public, backup và monitoring; đây là mô hình khuyến nghị cho hệ thống quan trọng |
| Cloudflare Quick Tunnel | Miễn phí | Demo ngắn hạn | URL ngẫu nhiên/thay đổi, không dùng cho QR production |

### Test trong cùng Wi-Fi bằng IP LAN

Nếu chỉ cần thử nhanh, không để `FRONTEND_URL` là `localhost` vì `localhost` trên điện thoại
trỏ tới chính điện thoại. Lấy IP LAN của máy chạy Docker (ví dụ `192.168.1.100`) và dùng:

```ini
FRONTEND_URL=http://192.168.1.100
CORS_ORIGINS=http://192.168.1.100
```

Điện thoại và máy chủ phải ở cùng mạng, firewall phải cho phép HTTP, và thiết bị Wi-Fi không
được bật AP/client isolation. Đây chỉ là mô hình test nội bộ; không dùng HTTP/IP LAN để public
Internet.

### Public miễn phí bằng Cloudflare Named Tunnel

Cloudflare Tunnel phù hợp khi máy local không có IP public hoặc không muốn mở port router.
Tạo **Named Tunnel** trong Cloudflare Zero Trust, tạo Public Hostname (ví dụ
`chamcong.example.com`) trỏ tới `http://nginx:80`, sau đó đặt token vào `.env`:

```ini
FRONTEND_URL=https://chamcong.example.com
CORS_ORIGINS=https://chamcong.example.com
PUBLIC_IP=
CLOUDFLARE_TUNNEL_TOKEN=<token-cua-named-tunnel>
```

Dùng cấu hình Nginx dành riêng cho tunnel và khởi động:

```bash
cp nginx/nginx.conf nginx/nginx.conf.backup
cp nginx/nginx.tunnel.conf nginx/nginx.conf
docker compose --profile tunnel up -d --build
docker compose logs -f cloudflared
```

Chỉ tiếp tục khi log báo tunnel đã đăng ký kết nối. QR phải chứa domain HTTPS cố định, không
phải `localhost`, IP LAN hoặc URL `trycloudflare.com` tạm thời. Máy chạy Docker phải luôn bật;
nếu máy ngủ, tắt hoặc mất mạng thì ứng dụng và QR sẽ không truy cập được.

Cloudflare Tunnel chỉ public ứng dụng, không thay thế allow-list Wi-Fi. Vẫn phải lấy IP public
của Wi-Fi công ty bằng điện thoại tại `https://api.ipify.org` và thêm IP đó vào
`ALLOWED_NETWORKS`. Kiểm tra cả Wi-Fi công ty và 4G sau khi cấu hình.

### Oracle Always Free hoặc VPS

Với Oracle Always Free, VPS giá rẻ hoặc nhà cung cấp khác, cài Docker trên Ubuntu rồi làm theo
các mục 1–8 của tài liệu này. Trỏ DNS về VPS, mở TCP 80/443, dùng domain HTTPS và không expose
các port PostgreSQL, backend hoặc frontend ra Internet. Đây là lựa chọn phù hợp hơn máy local
nếu cần hệ thống chạy liên tục.

Không nên dùng các nền tảng free có cơ chế sleep cho điểm danh hằng ngày nếu chưa kiểm tra
persistent database, giới hạn request, IP proxy và chính sách lưu trữ. Luôn có backup PostgreSQL
ở nơi khác trước khi dùng production.

## 1. Chuẩn bị hạ tầng
| Mục | Yêu cầu |
|---|---|
| Máy chủ | Ubuntu 22.04/24.04, 2 vCPU / 2 GB RAM; **IP public (VPS)** hoặc IP LAN nếu chỉ chạy nội bộ |
| Phần mềm | Docker Engine + Docker Compose plugin |
| Mạng | Mở inbound TCP 80/443 trên firewall/security group của VPS |
| DNS | Domain (VD `chamcong.congty.vn`) → bản ghi `A` trỏ IP public của VPS |

## 2. Lấy code & cấu hình `.env`
```bash
git clone <repo> mondaycheck && cd mondaycheck
cp .env.example .env
```
Giá trị tối thiểu cần sửa trong `.env` (file ở thư mục gốc, compose đọc tự động):

```ini
# Domain public (QR / check-in links are built from it) — KHÔNG để localhost.
FRONTEND_URL=https://chamcong.congty.vn
CORS_ORIGINS=https://chamcong.congty.vn
# Để trống khi dùng HTTPS (chỉ dùng cho link dự phòng HTTP trong LAN).
PUBLIC_IP=

# IP PUBLIC của Wi-Fi công ty (lấy ở bước 3) — không phải IP LAN 10.x.
# Nhiều đường internet/AP → thêm nhiều IP. KHÔNG đặt 172.16.0.0/12 ở production.
ALLOWED_NETWORKS=127.0.0.1,::1,203.0.113.10/32

# Bảo mật — đổi TRƯỚC lần seed đầu tiên:
JWT_SECRET=<openssl rand -hex 32>
ADMIN_PASSWORD=<mật khẩu admin mạnh>
POSTGRES_PASSWORD=<mật khẩu DB mạnh>
# Nếu mật khẩu DB có ký tự đặc biệt, đặt DATABASE_URL đã URL-encode:
# DATABASE_URL=postgresql://postgres:<password-encoded>@postgres:5432/mondaycheck?schema=public

# Chỉ đặt 10/phút vì mỗi điện thoại có IP riêng (đừng nới như khi test local)
CHECKIN_RATE_LIMIT_MAX=10
```
`ADMIN_PASSWORD` chỉ có tác dụng khi seed lần đầu (admin chưa tồn tại). Nếu DB đã có admin, phải đổi
mật khẩu trực tiếp trong DB (hiện chưa có trang đổi mật khẩu).

## 3. Xác định IP được phép điểm danh
**Public VPS:** VPS nhìn thấy **IP public của Wi-Fi công ty**. Trên điện thoại đang ở Wi-Fi công ty, mở
`https://api.ipify.org` (hoặc `https://<domain>/api/attendance/my-ip` sau khi deploy) và ghi lại IP public.
Thêm IP đó dạng `/32` vào `ALLOWED_NETWORKS`.

**Server trong LAN:** mở `http://<ip-lan>/api/attendance/my-ip` → trả về IP LAN, thêm dải LAN tương ứng.

1. Kiểm tra ở 2–3 vị trí/AP khác nhau; nếu ra nhiều IP public khác nhau thì thêm tất cả.
2. Nhập vào `ALLOWED_NETWORKS` (cần restart backend), **hoặc** đăng nhập app → menu **Wi-Fi** → thêm dải
   (lưu DB, áp dụng ngay không cần restart).
3. Kiểm tra: trong Wi-Fi công ty → `my-ip` trả `allowed: true`; tắt Wi-Fi (4G) → `allowed: false`.

## 3b. Cấu hình Wi-Fi hiển thị cho nhân sự
Đặt trong `.env` (rồi `docker compose up -d backend`):
```ini
WIFI_NAME=#P.DAOTAO_DDV GROUP
WIFI_PASSWORD=18006018
WIFI_INSTRUCTIONS=Tắt 4G/5G, vào Cài đặt > Wi-Fi, chọn đúng tên Wi-Fi bên dưới và nhập mật khẩu, sau đó bấm "Kiểm tra lại".
```
Khi IP ngoài allow-list, trang check-in hiện tên + mật khẩu Wi-Fi kèm nút Copy (hoạt động cả trên HTTP LAN).
HR xem lại cấu hình này tại menu **Wi-Fi** (khối "Wi-Fi công ty").

## 4. Build & chạy
```bash
docker compose up -d --build
docker compose exec backend npx prisma db push      # tạo bảng (lần đầu)
docker compose exec backend npx tsx prisma/seed.ts  # admin hr/Admin@123 + dải mặc định
```
**Đổi mật khẩu admin ngay sau khi đăng nhập lần đầu** (hoặc sửa `ADMIN_PASSWORD` trong `.env` trước khi seed).

Sau đó: đăng nhập → **Employees** → Import file Excel nhân sự → **Sessions** → tạo phiên (ngày hôm nay, khung giờ
bao quanh giờ điểm danh) → **Mở điểm danh** → chiếu QR.

## 4b. Phiên điểm danh hằng ngày (điểm danh "reset" theo ngày)
Điểm danh chống trùng theo **phiên** (`@@unique([sessionId, employeeId])`), nên sang ngày mới chỉ cần **phiên mới**.
Bật tự động trong `.env`:

```ini
AUTO_SESSION_ENABLED=true
AUTO_SESSION_NAME=Sinh hoạt đầu giờ
AUTO_SESSION_START=08:00
AUTO_SESSION_END=11:00
AUTO_SESSION_TIMEZONE=Asia/Ho_Chi_Minh
```
- Backend kiểm tra mỗi phút (theo giờ VN): tới `START` → tự tạo phiên hôm nay và mở `ACTIVE`; quá `END` → tự `CLOSED` (QR hết hiệu lực).
- Phiên tự tạo không có token QR sẵn: HR vào **Sessions → chọn phiên → nút "Tạo mã QR"** (`POST /api/sessions/:id/rotate-qr`).
  Tạo mã mới sẽ **vô hiệu mã cũ** (dùng khi QR bị lộ).
- Cần nhiều phiên/ngày (sáng + chiều): tạo tay phiên thứ hai — dữ liệu đều lưu riêng theo phiên, export từng phiên.

## 5. HTTPS + domain (bắt buộc khi deploy public)
Stack đang chạy HTTP bằng `nginx/nginx.conf`. Làm lần lượt trên VPS:

```bash
# 1) Cài certbot trên máy host
sudo apt update && sudo apt install -y certbot

# 2) Lấy cert bằng webroot (nginx đang phục vụ /.well-known/acme-challenge/)
#    Thay domain + email thật; đứng tại thư mục dự án.
sudo certbot certonly --webroot -w "$PWD/nginx/certbot" \
  -d chamcong.congty.vn --email admin@congty.vn --agree-tos --no-eff-email

# 3) Copy cert sang thư mục compose mount
sudo mkdir -p nginx/certs
sudo cp /etc/letsencrypt/live/chamcong.congty.vn/fullchain.pem nginx/certs/
sudo cp /etc/letsencrypt/live/chamcong.congty.vn/privkey.pem   nginx/certs/
sudo chown -R "$USER":"$USER" nginx/certs

# 4) Sửa 2 chỗ server_name trong nginx/nginx.prod.conf thành domain thật, rồi thay file
cp nginx/nginx.conf nginx/nginx.http.conf.bak
cp nginx/nginx.prod.conf nginx/nginx.conf

# 5) Nạp lại nginx và kiểm tra
docker compose restart nginx
curl -I https://chamcong.congty.vn
```

Gia hạn tự động (certbot đã có timer): thêm deploy hook để copy cert mới + reload nginx:
```bash
sudo certbot renew --deploy-hook "cp /etc/letsencrypt/live/chamcong.congty.vn/fullchain.pem /opt/mondaycheck/nginx/certs/ && cp /etc/letsencrypt/live/chamcong.congty.vn/privkey.pem /opt/mondaycheck/nginx/certs/ && docker compose -f /opt/mondaycheck/docker-compose.yml exec -T nginx nginx -s reload"
```
> Đổi `/opt/mondaycheck` theo đường dẫn thật của dự án. Nếu dùng cert của công ty (không phải Let's Encrypt) thì chỉ cần bước 3–4.

## 5b. Cloudflare Tunnel (khi VPS không có IP public)
Phù hợp với VPS đặt trong văn phòng, không có IPv4 public. Cloudflare Tunnel chỉ mở kết nối **outbound**
từ VPS, không cần NAT/port-forward 80/443.

**Nhà cung cấp cần làm:**
1. Tạo **Named Tunnel** (không dùng Quick Tunnel) trong Cloudflare Zero Trust → Networks → Tunnels.
2. Public Hostname: `chamcong.congty.vn` → service `http://nginx:80` (cloudflared chạy trong compose của repo).
3. Gửi **tunnel token** qua kênh an toàn (hoặc cấp quyền quản lý zone Cloudflare).
4. Xác nhận domain đã dùng nameserver Cloudflare; record `chamcong` ở trạng thái proxied.
5. Không bật WAF/Bot Fight/Under Attack cho `/checkin` và `/api/*`; SSL/TLS mode **Full**.
6. Outbound: cho phép TCP 443 và UDP 7844 (cloudflared).

**Trên VPS:**
```bash
# .env
CLOUDFLARE_TUNNEL_TOKEN=<token>
FRONTEND_URL=https://chamcong.congty.vn
CORS_ORIGINS=https://chamcong.congty.vn
PUBLIC_IP=
ALLOWED_NETWORKS=127.0.0.1,::1,<IP-public-cua-Wi-Fi-cong-ty>/32

# Dùng nginx.tunnel.conf (backup file cũ)
cp nginx/nginx.conf nginx/nginx.http.conf.bak
cp nginx/nginx.tunnel.conf nginx/nginx.conf

# Khởi động cloudflared + nginx
docker compose --profile tunnel up -d
docker compose logs -f cloudflared   # chờ "Registered tunnel connection"
```
`nginx.tunnel.conf` chỉ tin `CF-Connecting-IP` từ container cloudflared (`10.250.250.250`), nên client khác
không thể giả IP. Backend nhận `X-Forwarded-For` = IP thật của nhân viên.

**Kiểm tra:**
- `curl -I https://chamcong.congty.vn` → 200/301, cert hợp lệ.
- Trong Wi-Fi công ty: `https://.../api/attendance/my-ip` → IP public công ty, `allowed: true`.
- 4G: `allowed: false`; check-in trả 403.
- `docker compose logs nginx` phải thấy IP client thật (không phải `10.250.250.250`).

**Lưu ý:**
- Nếu nhà cung cấp cài cloudflared trên host thay vì container: trỏ `--url http://127.0.0.1:8080`, publish
  nginx `127.0.0.1:8080:80`, và báo để chỉnh `set_real_ip_from` (không dùng IP `10.250.250.250`).
- Cloudflare có thể trả IPv6 trong `CF-Connecting-IP`; repo hiện chỉ so khớp IPv4/`::1` — nếu `my-ip` ra IPv6,
  cần bổ sung trước khi chốt Wi-Fi.
- Không chạy thêm reverse proxy/CDN khác trước Cloudflare.

## 6. Vận hành
```bash
docker compose ps                      # trạng thái các service
docker compose logs -f backend         # log API
docker compose exec -T postgres pg_dump -U postgres mondaycheck > backup_$(date +%F).sql   # backup
```
- Cập nhật phiên bản: `git pull && docker compose up -d --build`.
- Đổi `JWT_SECRET` sẽ buộc mọi admin đăng nhập lại.
- QR của phiên cũ vẫn dùng được tới khi đóng phiên (token lưu dạng hash, không lộ).

## 7. Checklist nghiệm thu
| # | Kiểm tra | Kỳ vọng |
|---|---|---|
| 1 | Điện thoại **trong** Wi-Fi công ty mở QR và điểm danh | Thành công |
| 2 | Điện thoại dùng **4G** (tắt Wi-Fi) | 403 "chỉ Wi-Fi công ty" |
| 3 | Điểm danh lần 2 cùng người/phiên | 400 "đã điểm danh" |
| 4 | Nhập sai mã NV | 400 kèm mã vừa nhập |
| 5 | Đóng phiên rồi quét lại | Báo "Phiên đã đóng" |
| 6 | Ngoài khung giờ | Báo "Chưa đến giờ"/"Đã kết thúc" |
| 7 | Export Excel trong Reports | Tải được file .xlsx |
| 8 | `my-ip` ở bước 3 | `allowed: true` trong Wi-Fi |
| 9 | Wi-Fi → tạm tắt dải đang dùng rồi kiểm tra lại | `allowed: false`; bật lại → `true` ngay, không cần restart |

## 8. Lỗi thường gặp
| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| Mọi người đều điểm danh được dù ngoài công ty | Chạy Docker Desktop Windows (NAT) → chuyển sang Linux, hoặc đang để `172.16.0.0/12` trong `ALLOWED_NETWORKS` |
| Trong Wi-Fi vẫn 403 | Sai dải CIDR; xem lại `my-ip`; kiểm tra máy chủ có nằm sau NAT/proxy khác (tăng `trust proxy` hop) |
| QR không mở được trên Android | `FRONTEND_URL` đang là IP `http://` → dùng domain (`https://...`); hoặc dùng link dự phòng trong trang phiên |
| 429 Too many requests | Hạ/tăng `CHECKIN_RATE_LIMIT_MAX`, kiểm tra có proxy làm mất IP thật (khi đó mọi người chung 1 IP) |
| Đang ở Wi-Fi công ty nhưng vẫn 403 sau khi lên VPS | IP public của công ty đã đổi → mở `https://api.ipify.org` trên điện thoại và cập nhật `ALLOWED_NETWORKS` |
| Mọi request có cùng IP lạ (VD IP Cloudflare) | Đang dùng proxy/CDN trước VPS → bỏ proxy, hoặc bật `--profile tunnel` với `nginx.tunnel.conf` (đã xử lý `CF-Connecting-IP` từ container cloudflared) |
| `prisma db push` lỗi xác thực DB | `POSTGRES_PASSWORD` và `DATABASE_URL` không khớp, hoặc chưa URL-encode ký tự đặc biệt |
| Sai giờ điểm danh | Container chạy UTC là bình thường — mốc thời gian lưu dạng UTC, UI hiển thị theo giờ máy người dùng |
