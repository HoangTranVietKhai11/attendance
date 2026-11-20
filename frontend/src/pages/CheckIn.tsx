import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { CheckCircle2, AlertCircle, Loader2, Wifi, Copy, RefreshCw } from 'lucide-react';

type NetInfo = { ip: string; allowed: boolean; wifiName?: string };

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('t') || '';
  const [session, setSession] = useState<any>(null);
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [net, setNet] = useState<NetInfo | null>(null);
  const [wifi, setWifi] = useState<{ name: string; password: string | null; instructions: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  const checkNetwork = useCallback(async () => {
    setChecking(true);
    const res = await apiJson<NetInfo>('/api/attendance/my-ip');
    if (res.success && res.data) setNet(res.data);
    setChecking(false);
  }, []);

  useEffect(() => {
    checkNetwork();
    apiJson<{ wifiName: string; wifiPassword: string | null; wifiInstructions: string | null }>('/api/config').then(
      (res) => {
        if (res.success && res.data) {
          setWifi({
            name: res.data.wifiName,
            password: res.data.wifiPassword,
            instructions: res.data.wifiInstructions,
          });
        }
      }
    );
  }, [checkNetwork]);

  async function copyValue(key: string, value: string) {
    const ok = await copyText(value);
    if (!ok) return;
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1500);
  }

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setVerifyError('Mã QR không hợp lệ.');
      return;
    }
    apiJson(`/api/sessions/verify?t=${encodeURIComponent(token)}`).then((res) => {
      setVerifying(false);
      if (res.success && res.data) {
        setSession(res.data);
      } else {
        setVerifyError(res.error || 'Mã QR không hợp lệ hoặc đã hết hạn.');
      }
    });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !session?.checkInAllowed || net?.allowed !== true) return;
    setSubmitting(true);
    setMessage('');
    const res = await apiJson('/api/attendance/checkin', {
      method: 'POST',
      body: JSON.stringify({ token, employeeCode: code.trim(), fullName: name.trim() }),
    });
    setSubmitting(false);
    if (res.success) {
      setDone(true);
      setMessage(res.data?.message || 'Điểm danh thành công!');
    } else {
      setMessage(res.error || 'Điểm danh thất bại. Vui lòng thử lại.');
    }
  }

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Đang kiểm tra phiên điểm danh…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="card w-full max-w-md text-center">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Không thể điểm danh</h2>
          <p className="text-sm text-gray-600 mb-4">{verifyError}</p>
          <button onClick={() => navigate('/')} className="btn-primary">Về trang chủ</button>
        </div>
      </div>
    );
  }

  const allowed = session.checkInAllowed;
  const networkAllowed = net?.allowed === true;
  const canSubmit = allowed && networkAllowed;
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

  const now = Date.now();
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();
  let closedReason = 'Phiên điểm danh hiện không mở.';
  if (session.status === 'CLOSED') {
    closedReason = 'Phiên điểm danh đã đóng.';
  } else if (now < startMs) {
    closedReason = `Chưa đến giờ điểm danh. Phiên mở lúc ${fmtTime(session.startTime)} ngày ${fmtDate(session.startTime)}.`;
  } else if (now > endMs) {
    closedReason = `Phiên đã kết thúc lúc ${fmtTime(session.endTime)} ngày ${fmtDate(session.endTime)}.`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-md">
        {!done ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">MondayCheck</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Điểm danh</h2>
            <p className="text-sm text-gray-600 mb-4">
              {session.sessionName} – {fmtDate(session.sessionDate)} ({fmtTime(session.startTime)}–{fmtTime(session.endTime)})
            </p>
            {!allowed && (
              <div className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700 border border-red-100">
                {closedReason}
              </div>
            )}
            {net && !net.allowed && session.status === 'ACTIVE' && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <Wifi size={16} /> Cần kết nối đúng Wi-Fi công ty
                </div>
                <p className="mb-3 text-xs text-amber-800">
                  Thiết bị đang sử dụng Wi-Fi khác hoặc 4G/5G. Vui lòng kết nối Wi-Fi công ty bên dưới.
                  {wifi?.instructions ? ` ${wifi.instructions}` : ''}
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2">
                    <div>
                      <p className="text-gray-500">Tên Wi-Fi</p>
                      <p className="font-mono font-semibold text-gray-900">{wifi?.name || net.wifiName || 'Wi-Fi công ty'}</p>
                    </div>
                    <button
                      onClick={() => copyValue('ssid', wifi?.name || net.wifiName || '')}
                      className="btn-ghost !px-2 !py-1"
                      title="Sao chép tên Wi-Fi"
                    >
                      {copiedKey === 'ssid' ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                  {wifi?.password && (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2">
                      <div>
                        <p className="text-gray-500">Mật khẩu</p>
                        <p className="font-mono font-semibold text-gray-900">{wifi.password}</p>
                      </div>
                      <button
                        onClick={() => copyValue('pass', wifi.password!)}
                        className="btn-ghost !px-2 !py-1"
                        title="Sao chép mật khẩu"
                      >
                        {copiedKey === 'pass' ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={checkNetwork} disabled={checking} className="btn-primary mt-3 w-full text-sm">
                  <RefreshCw size={15} /> {checking ? 'Đang kiểm tra…' : 'Đã kết nối, kiểm tra lại'}
                </button>
              </div>
            )}
            {message && (
              <div className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700 border border-red-100">
                {message}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mã nhân viên</label>
                <input
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Nhập Mã NV"
                  required
                  disabled={!canSubmit}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Họ và tên</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập họ tên đầy đủ"
                  required
                  disabled={!canSubmit}
                />
              </div>
              <button
                className="btn-primary w-full"
                disabled={submitting || !canSubmit}
              >
                {submitting
                  ? 'Đang gửi…'
                  : !allowed
                  ? 'Phiên chưa mở'
                  : networkAllowed
                  ? 'Gửi điểm danh'
                  : 'Chưa đúng Wi-Fi phòng đào tạo'}
              </button>
            </form>
            <p className="mt-4 text-xs text-gray-500 text-center">
              {net
                ? net.allowed
                  ? 'Đang kết nối Wi-Fi công ty – đủ điều kiện điểm danh.'
                  : 'Đang sử dụng Wi-Fi khác – vui lòng kết nối Wi-Fi công ty để điểm danh.'
                : 'Chỉ có thể điểm danh khi kết nối Wi-Fi công ty.'}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 text-center mb-1">
              Điểm danh thành công!
            </h2>
            <p className="text-sm text-gray-600 text-center mb-4">
              {message}
            </p>
            <p className="text-xs text-gray-500 text-center">
              Thông tin đã được ghi nhận cho phiên {session.sessionName}.
            </p>
            <button onClick={() => window.location.reload()} className="btn-ghost w-full text-sm">
              Điểm danh lại (khác người)
            </button>
          </>
        )}
      </div>
    </div>
  );
}