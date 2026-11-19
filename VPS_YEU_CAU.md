# Yêu cầu cung cấp VPS — Hệ thống điểm danh QR nội bộ

## Bản ngắn (copy gửi sales/email)

> Kính gửi anh/chị,
>
> Công ty chúng tôi cần thuê **01 VPS public** để triển khai hệ thống điểm danh QR cho khoảng **300 nhân sự**
> (website React + API Node.js + PostgreSQL, chạy bằng Docker Compose).
>
> Yêu cầu chính:
> - Ubuntu 24.04 LTS 64-bit, **2 vCPU / 4 GB RAM / 80 GB SSD**, đặt tại Việt Nam.
> - **01 IPv4 public tĩnh riêng** (không CGNAT, không dùng chung IP).
> - Mở inbound **TCP 80/443** từ Internet; **SSH 22** chỉ từ IP quản trị của công ty.
> - **Không đặt reverse proxy/CDN/WAF của nhà cung cấp trước VPS** (hoặc phải chuyển được IP client thật
>   qua header `X-Forwarded-For`/PROXY protocol). Hệ thống chặn điểm danh theo IP public của Wi-Fi công ty,
>   nếu IP bị che sẽ sai.
> - Cho phép cài **Docker Engine + Docker Compose**; cấp quyền **root/sudo** và **SSH bằng public key**.
> - Snapshot tự động hàng ngày (giữ 7–14 ngày), có giám sát uptime và hỗ trợ restore.
> - Domain/DNS: công ty sẽ trỏ domain về IP VPS (hoặc báo giá kèm domain + DNS).
>
> Ứng dụng do chúng tôi tự triển khai; nhà cung cấp chỉ cần bàn giao OS sạch + mạng đúng yêu cầu.
> Chi tiết kỹ thuật ở phần dưới. Trân trọng.

---

## 1. Mục đích & tải dự kiến
- Hệ thống điểm danh bằng QR cho khoảng **250–300 nhân sự**, cao điểm buổi sáng ~250 lượt trong 10 phút.
- Thành phần: Nginx (reverse proxy + HTTPS), React static, Node.js/Express API, PostgreSQL, Docker Compose.
- Người dùng truy cập từ điện thoại trong Wi-Fi công ty và ngoài công ty (4G/5G).

## 2. Cấu hình VPS
| Hạng mục | Tối thiểu | Khuyến nghị |
|---|---|---|
| CPU | 2 vCPU | 2–4 vCPU |
| RAM | 2 GB | **4 GB** |
| Disk | 40 GB SSD | **80 GB SSD** |
| Bandwidth | 100 GB/tháng | Không giới hạn nếu có |
| Vị trí | Việt Nam (HCM/Hà Nội) | Cùng miền với người dùng |
| IPv4 | 1 IP public tĩnh | + IPv6 (tùy chọn, xem mục 4) |

> Gói 2 vCPU / 2 GB vẫn chạy được, nhưng 4 GB giúp dư bộ nhớ khi build Docker và backup.

## 3. Hệ điều hành & phần mềm
- **Ubuntu 24.04 LTS 64-bit** (hoặc 22.04 LTS), bản minimal, không panel bắt buộc.
- Quyền **root hoặc sudo**; truy cập **SSH bằng public key** (có thể cấp key của chúng tôi).
- Cho phép cài đặt: **Docker Engine**, **Docker Compose plugin**, `certbot` (Let's Encrypt).
- Timezone `Asia/Ho_Chi_Minh`, đồng bộ NTP.
- Không cài sẵn Apache/Nginx chiếm cổng 80/443 (nếu có, vui lòng thông báo trước khi bàn giao).

## 4. Mạng & firewall (phần quan trọng nhất)
- **01 IPv4 public tĩnh, riêng cho VPS**, không CGNAT/NAT, không dùng chung với khách khác.
- Inbound:
  - `TCP 80` từ Internet (Let's Encrypt HTTP-01 + redirect HTTPS).
  - `TCP 443` từ Internet (HTTPS).
  - `TCP 22` **chỉ từ IP quản trị** của công ty (chúng tôi sẽ cung cấp).
- Outbound: không giới hạn (apt, Let's Encrypt, NTP).
- **Không đặt reverse proxy/CDN/WAF của nhà cung cấp trước VPS.** Nếu bắt buộc có, phải chuyển IP client
  thật qua `X-Forwarded-For` hoặc PROXY protocol và xác nhận bằng test.
  Lý do: hệ thống chỉ cho điểm danh khi IP client thuộc IP public của Wi-Fi công ty; nếu IP bị thay bằng IP
  của CDN/NAT thì chốt Wi-Fi sai (hoặc chặn nhầm toàn bộ nhân viên).
- IPv6: nếu bật, vui lòng thông báo. Ứng dụng hiện chỉ xử lý IPv4 (và `::1`), nên ưu tiên IPv4.
- Không mở ra ngoài các cổng `4000` (API nội bộ), `5432` (PostgreSQL), `5173` (frontend debug).

## 5. Tên miền & HTTPS
- Công ty cung cấp domain (hoặc nhà cung cấp báo giá kèm domain + DNS).
- Cần quyền trỏ bản ghi `A` của domain về IP VPS; không cần transfer domain.
- HTTPS bắt buộc (QR mở trên Android/iOS). Chúng tôi dùng **Let's Encrypt + certbot**:
  - Cần cổng 80 mở cho HTTP-01; hoặc
  - Hỗ trợ DNS-01 nếu có API quản lý DNS.
- Nếu nhà cung cấp có SSL sẵn: cần cung cấp `fullchain.pem` + `privkey.pem` và cơ chế gia hạn.
- Cung cấp email kỹ thuật để nhận cảnh báo hết hạn cert.

## 6. Bàn giao & truy cập
Khi bàn giao, cung cấp:
- [ ] IP public của VPS
- [ ] Port SSH (mặc định 22 hoặc port khác)
- [ ] User có sudo (hoặc root) + cách xác thực (public key/console)
- [ ] Console web dự phòng (nếu có)
- [ ] Thông tin datacenter/khu vực, uptime cam kết, chính sách reboot

Không cần cài ứng dụng; chúng tôi tự deploy bằng Docker.

## 7. Sao lưu & giám sát
- **Snapshot tự động hàng ngày**, giữ **7–14 ngày**, có thể restore vào VPS mới.
- Giám sát uptime + cảnh báo qua email/Telegram khi VPS down hoặc đầy disk.
- (Tùy chọn) Hỗ trợ backup PostgreSQL: chúng tôi có thể tự chạy `pg_dump`; snapshot ổ là đủ.

## 8. Bảo mật
- Security group/firewall chỉ mở đúng các cổng ở mục 4.
- Có DDoS protection cơ bản (nếu gói hỗ trợ).
- Bật cập nhật bảo mật OS định kỳ (`unattended-upgrades`) hoặc thông báo khi có bản vá.
- Không chia sẻ IP public với khách hàng khác.

## 9. Nghiệm thu
1. SSH bằng key + `sudo` hoạt động.
2. `docker compose ps` chạy healthy; Docker tự khởi động lại sau khi reboot VPS.
3. Sau deploy: `curl -I https://<domain>` trả `200`/`301` hợp lệ; cert hợp lệ.
4. Từ điện thoại trong Wi-Fi công ty: điểm danh thành công; từ 4G: bị chặn `403`.
5. Restore thử một snapshot thành công.

## 10. Checklist xác nhận của nhà cung cấp
- [ ] IPv4 public tĩnh, không CGNAT/dùng chung
- [ ] Không proxy/CDN che IP client (hoặc có cách chuyển IP thật)
- [ ] Mở 80/443; SSH giới hạn theo IP quản trị
- [ ] Ubuntu 24.04 LTS + quyền root/sudo + SSH key
- [ ] Cho phép Docker Engine + Docker Compose + certbot
- [ ] Snapshot hàng ngày + giám sát uptime
- [ ] Domain/DNS (nếu cung cấp) và email kỹ thuật
- [ ] Thời gian bàn giao + SLA uptime

## 11. Ghi chú
- Ứng dụng do chúng tôi triển khai; nhà cung cấp **không cần cài** Node/PostgreSQL/ứng dụng.
- Nếu bàn giao kèm panel (aaPanel, CyberPanel…), vui lòng đảm bảo panel không chiếm 80/443 và firewall
  không mở rộng hơn mục 4.
- Nếu có nhiều gói, ưu tiên gói **4 GB RAM + IP public tĩnh + snapshot**; CPU 2 vCPU là đủ.
