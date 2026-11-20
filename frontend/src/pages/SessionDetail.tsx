import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { RefreshCw, Copy, CheckCircle2, QrCode, AlertTriangle } from 'lucide-react';

type SessionLinks = {
  token: string;
  url: string;
  fallbackUrl: string | null;
  qrDataUrl: string | null;
  reachable?: boolean;
};

export default function SessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [links, setLinks] = useState<SessionLinks | null>(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [rotating, setRotating] = useState(false);

  const load = useCallback(async () => {
    const res = await apiJson(`/api/sessions/${id}`);
    if (res.success) {
      setSession(res.data);
      setRecords(res.data.records || []);
    }
    setLoading(false);
  }, [id]);

  // One request returns the check-in link, the IP fallback link and the QR image itself
  // (base64). Rendering the returned image avoids the browser showing a cached QR of an
  // old token — scanning that stale code used to fail with "not found".
  const loadLinks = useCallback(async () => {
    const res = await apiJson<SessionLinks>(`/api/sessions/${id}/links`);
    if (res.success && res.data?.token && res.data.url) {
      setLinks(res.data);
      setQrSrc(res.data.qrDataUrl ?? null);
    } else {
      setLinks(null);
      setQrSrc(null);
    }
  }, [id]);

  useEffect(() => {
    load();
    loadLinks();
  }, [load, loadLinks]);

  function copyText(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 1500);
  }

  async function toggle(status: 'ACTIVE' | 'CLOSED') {
    const action = status === 'ACTIVE' ? 'start' : 'close';
    await apiJson(`/api/sessions/${id}/${action}`, { method: 'PATCH' });
    load();
  }

  // Issue (or revoke + re-issue) the QR token of this session and show the new image.
  async function createQr() {
    setRotating(true);
    const res = await apiJson<{ qrDataUrl: string }>(`/api/sessions/${id}/rotate-qr`, {
      method: 'POST',
    });
    setRotating(false);
    if (res.success && res.data?.qrDataUrl) setQrSrc(res.data.qrDataUrl);
    await loadLinks();
  }


  if (loading) return <div className="card p-6">Đang tải…</div>;
  if (!session) return <div className="card p-6">Không tìm thấy phiên.</div>;

  const now = new Date();
  const isWithinWindow = now >= new Date(session.startTime) && now <= new Date(session.endTime);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/sessions" className="btn-ghost text-sm">
          ← Quay lại danh sách phiên
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Mã QR – hiển thị trên màn hình/Tivi
            </div>
            {qrSrc ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={qrSrc}
                  alt="QR code"
                  className="w-full max-w-[340px] h-auto rounded-lg border border-gray-200 bg-white p-3"
                />
                <button onClick={createQr} disabled={rotating} className="btn-ghost text-xs">
                  <RefreshCw size={13} /> {rotating ? 'Đang tạo…' : 'Tạo lại mã QR mới'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-gray-500">
                <QrCode size={40} className="text-gray-300" />
                <p>Phiên này chưa có mã QR.</p>
                <button onClick={createQr} disabled={rotating} className="btn-primary">
                  <RefreshCw size={15} /> {rotating ? 'Đang tạo…' : 'Tạo mã QR'}
                </button>
              </div>
            )}
            {links && (
              <div className="w-full space-y-2 rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 shrink-0 pt-0.5">Link</span>
                  <a href={links.url} target="_blank" rel="noreferrer" className="text-blue-600 break-all flex-1">
                    {links.url}
                  </a>
                  <button onClick={() => copyText('primary', links.url)} className="btn-ghost !px-2 !py-1 shrink-0" title="Sao chép link">
                    {copiedKey === 'primary' ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                  </button>
                </div>
                {links.fallbackUrl && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 shrink-0 pt-0.5">IP</span>
                    <a href={links.fallbackUrl} target="_blank" rel="noreferrer" className="text-blue-600 break-all flex-1">
                      {links.fallbackUrl}
                    </a>
                    <button onClick={() => copyText('fallback', links.fallbackUrl!)} className="btn-ghost !px-2 !py-1 shrink-0" title="Sao chép link IP">
                      {copiedKey === 'fallback' ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
                {links.reachable === false && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Link QR đang trỏ tới <b>localhost</b> nên điện thoại quét sẽ báo không tìm thấy.
                      Hãy mở web bằng IP LAN (ví dụ <b>http://10.0.10.76</b>) hoặc tên miền rồi bấm
                      “Tạo lại mã QR mới”.
                    </span>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 text-center">
              Nhân sự quét mã QR → nhập Mã NV &amp; Họ tên → điểm danh.
            </p>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Thông tin phiên</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Tên phiên</span>
              <span className="font-medium">{session.sessionName}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Ngày</span>
              <span className="font-medium">{new Date(session.sessionDate).toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Khung giờ</span>
              <span className="font-medium">
                {new Date(session.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} –
                {new Date(session.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Trạng thái</span>
              <span className={`font-medium ${
                session.status === 'ACTIVE' ? 'text-green-600' : session.status === 'CLOSED' ? 'text-gray-600' : 'text-blue-600'
              }`}>
                {session.status === 'ACTIVE' ? 'Đang mở' : session.status === 'CLOSED' ? 'Đã đóng' : 'Lên lịch'}
              </span>
            </div>
          </div>
          {session.status === 'ACTIVE' && !isWithinWindow && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-2">
              {new Date() < new Date(session.startTime)
                ? 'Phiên đang mở nhưng chưa đến giờ bắt đầu — nhân sự chưa điểm danh được.'
                : 'Phiên đang mở nhưng đã qua giờ kết thúc — nhân sự không điểm danh được nữa.'}
            </p>
          )}
          <div className="mt-4 space-y-2">
            {session.status === 'SCHEDULED' && (
              <button onClick={() => toggle('ACTIVE')} className="btn-primary w-full">
                <RefreshCw size={16} /> Mở điểm danh
              </button>
            )}
            {session.status === 'ACTIVE' && (
              <button onClick={() => toggle('CLOSED')} className="btn-danger w-full">
                Đóng điểm danh (hết hạn QR)
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <h2 className="table-header">Dữ liệu điểm danh</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="table-header">Mã NV</th>
              <th className="table-header">Họ và tên</th>
              <th className="table-header">Giờ check-in</th>
              <th className="table-header">IP</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{r.employee?.employeeCode}</td>
                <td className="table-cell">{r.employee?.fullName}</td>
                <td className="table-cell text-gray-600">
                  {new Date(r.checkInTime).toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="table-cell text-gray-600 text-xs font-mono">{r.clientIp}</td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={4} className="table-cell text-center text-gray-500 text-sm">
                  Chưa có nhân sự nào điểm danh.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}