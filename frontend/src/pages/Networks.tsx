import { useState, useEffect, useCallback } from 'react';
import { apiJson } from '../lib/api';
import { copyText } from '../lib/clipboard';
import {
  Plus,
  Trash2,
  Wifi,
  Power,
  PowerOff,
  Copy,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

type AllowedNetwork = {
  id: string;
  networkName: string;
  publicIpOrCidr: string;
  isActive: boolean;
  createdAt: string;
};

type NetworksPayload = { networks: AllowedNetwork[]; env: string[] };
type NetInfo = { ip: string; allowed: boolean; wifiName?: string };
type WifiConfig = { name: string; password: string | null; instructions: string | null };

export default function Networks() {
  const [networks, setNetworks] = useState<AllowedNetwork[]>([]);
  const [envRanges, setEnvRanges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [name, setName] = useState('');
  const [cidr, setCidr] = useState('');
  const [me, setMe] = useState<NetInfo | null>(null);
  const [wifi, setWifi] = useState<WifiConfig | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const load = useCallback(async () => {
    const res = await apiJson<NetworksPayload>('/api/networks');
    if (res.success && res.data) {
      setNetworks(res.data.networks || []);
      setEnvRanges(res.data.env || []);
    } else if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  const loadMyIp = useCallback(async () => {
    const res = await apiJson<NetInfo>('/api/attendance/my-ip');
    if (res.success && res.data) setMe(res.data);
  }, []);

  const loadWifi = useCallback(async () => {
    const res = await apiJson<{
      wifiName: string;
      wifiPassword: string | null;
      wifiInstructions: string | null;
    }>('/api/config');
    if (res.success && res.data) {
      setWifi({
        name: res.data.wifiName,
        password: res.data.wifiPassword,
        instructions: res.data.wifiInstructions,
      });
    }
  }, []);

  useEffect(() => {
    load();
    loadMyIp();
    loadWifi();
  }, [load, loadMyIp, loadWifi]);

  async function copy(key: string, value: string) {
    const ok = await copyText(value);
    if (!ok) {
      setError('Không sao chép được. Hãy chọn nội dung và sao chép thủ công.');
      return;
    }
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1500);
  }

  async function add() {
    if (!name.trim() || !cidr.trim()) return;
    setSaving(true);
    setError('');
    setNotice('');
    const res = await apiJson('/api/networks', {
      method: 'POST',
      body: JSON.stringify({ networkName: name.trim(), publicIpOrCidr: cidr.trim(), isActive: true }),
    });
    setSaving(false);
    if (res.success) {
      setName('');
      setCidr('');
      setNotice('Đã thêm dải mạng. Dải mới có hiệu lực ngay, không cần khởi động lại.');
      load();
      loadMyIp();
    } else {
      setError(res.error || 'Không thêm được dải mạng.');
    }
  }

  async function toggle(n: AllowedNetwork) {
    setBusyId(n.id);
    setError('');
    setNotice('');
    const res = await apiJson(`/api/networks/${n.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !n.isActive }),
    });
    setBusyId('');
    if (!res.success) {
      setError(res.error || 'Không cập nhật được dải mạng.');
      return;
    }
    load();
    loadMyIp();
  }

  async function remove(id: string) {
    if (!window.confirm('Xoá dải mạng này?')) return;
    setError('');
    const res = await apiJson(`/api/networks/${id}`, { method: 'DELETE' });
    if (!res.success) {
      setError(res.error || 'Không xoá được dải mạng.');
      return;
    }
    load();
    loadMyIp();
  }

  function useCurrent(subnet: boolean) {
    if (!me?.ip) return;
    const parts = me.ip.split('.');
    const isIpv4 = parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p));
    setCidr(subnet && isIpv4 ? `${parts.slice(0, 3).join('.')}.0/24` : me.ip);
  }

  const activeCount = networks.filter((n) => n.isActive).length;

  if (loading) return <div className="card p-6">Đang tải…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wi-Fi điểm danh</h1>
        <p className="text-gray-600 text-sm">
          Chỉ thiết bị có IP nằm trong các dải dưới đây mới được điểm danh. Hệ thống dùng hợp của dải
          khai báo trong <span className="font-mono">.env</span> và dải thêm tại trang này.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Wifi size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-700">Thiết bị đang mở trang này</h2>
          </div>
          {me ? (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">{me.ip}</span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                    me.allowed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {me.allowed ? 'Đủ điều kiện điểm danh' : 'IP này chưa được cho phép'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Wi-Fi yêu cầu: <span className="font-mono">{me.wifiName || '—'}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => useCurrent(false)} className="btn-ghost text-xs">
                  Dùng IP này (/32)
                </button>
                <button onClick={() => useCurrent(true)} className="btn-ghost text-xs">
                  Dùng dải /24 (IPv4)
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Không đọc được IP (API không phản hồi).</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-700">Wi-Fi công ty (hiện cho nhân sự)</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2">
              <div>
                <p className="text-gray-500 text-xs">Tên Wi-Fi</p>
                <p className="font-mono font-semibold text-gray-900">
                  {wifi?.name || me?.wifiName || 'Wi-Fi công ty'}
                </p>
              </div>
              <button
                onClick={() => copy('ssid', wifi?.name || me?.wifiName || '')}
                className="btn-ghost !px-2 !py-1"
                title="Sao chép tên Wi-Fi"
              >
                {copiedKey === 'ssid' ? (
                  <CheckCircle2 size={14} className="text-green-600" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            {wifi?.password && (
              <div className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2">
                <div>
                  <p className="text-gray-500 text-xs">Mật khẩu</p>
                  <p className="font-mono font-semibold text-gray-900">
                    {showPassword ? wifi.password : '••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPassword((v) => !v)}
                    className="btn-ghost !px-2 !py-1"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={() => copy('pass', wifi.password || '')}
                    className="btn-ghost !px-2 !py-1"
                    title="Sao chép mật khẩu"
                  >
                    {copiedKey === 'pass' ? (
                      <CheckCircle2 size={14} className="text-green-600" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          {wifi?.instructions && <p className="mt-3 text-xs text-gray-500">{wifi.instructions}</p>}
          <p className="mt-3 text-xs text-gray-500">
            Cấu hình bởi <span className="font-mono">WIFI_NAME</span>,{' '}
            <span className="font-mono">WIFI_PASSWORD</span>, <span className="font-mono">WIFI_INSTRUCTIONS</span>{' '}
            trong <span className="font-mono">.env</span>.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 text-sm text-red-700 border border-red-100">{error}</div>
      )}
      {notice && (
        <div className="p-3 rounded-md bg-green-50 text-sm text-green-700 border border-green-100">{notice}</div>
      )}

      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Thêm dải mạng</h2>
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tên (VD: Wi-Fi văn phòng)</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Wi-Fi công ty" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">IP / CIDR (VD: 10.0.10.0/24)</label>
            <input className="input font-mono" value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="10.0.10.0/24" />
          </div>
          <button onClick={add} disabled={saving || !name.trim() || !cidr.trim()} className="btn-primary">
            <Plus size={16} /> {saving ? 'Đang lưu…' : 'Thêm'}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Nhân sự mở <span className="font-mono">/api/attendance/my-ip</span> trên điện thoại (đang bật Wi-Fi
          công ty) để biết IP máy chủ nhìn thấy, hoặc bấm “Dùng IP này” ở trên nếu đang mở trang bằng máy trong
          Wi-Fi công ty.
        </p>
      </div>

      <div className="card overflow-hidden">
        <h2 className="table-header">
          Dải mạng trong hệ thống ({activeCount}/{networks.length} đang bật)
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="table-header">Tên</th>
              <th className="table-header">IP / CIDR</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {networks.map((n) => (
              <tr key={n.id} className="hover:bg-gray-50">
                <td className={`table-cell font-medium ${n.isActive ? '' : 'text-gray-400'}`}>
                  {n.networkName}
                </td>
                <td className={`table-cell font-mono text-xs ${n.isActive ? '' : 'text-gray-400'}`}>
                  {n.publicIpOrCidr}
                </td>
                <td className="table-cell">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                      n.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {n.isActive ? 'Đang bật' : 'Tạm tắt'}
                  </span>
                </td>
                <td className="table-cell text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggle(n)}
                      disabled={busyId === n.id}
                      className="btn-ghost text-xs"
                      title={n.isActive ? 'Tạm tắt dải này' : 'Bật lại dải này'}
                    >
                      {n.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                      {busyId === n.id ? '…' : n.isActive ? 'Tắt' : 'Bật'}
                    </button>
                    <button
                      onClick={() => remove(n.id)}
                      className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                      title="Xoá dải mạng"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {networks.length === 0 && (
              <tr>
                <td colSpan={4} className="table-cell text-center text-gray-500 text-sm">
                  Chưa có dải mạng nào trong DB.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">
            Dải cố định từ <span className="font-mono">ALLOWED_NETWORKS</span> (.env)
          </h2>
        </div>
        {envRanges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {envRanges.map((entry) => (
              <span key={entry} className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                {entry}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Chưa khai báo dải nào trong .env.</p>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Các dải này luôn được áp dụng và chỉ thay đổi được bằng cách sửa <span className="font-mono">.env</span> rồi
          chạy lại backend. Dải thêm/xoá ở bảng trên có hiệu lực ngay, không cần khởi động lại.
        </p>
      </div>

    </div>
  );
}
