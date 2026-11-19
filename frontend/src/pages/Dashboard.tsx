import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiJson, apiRequest } from '../lib/api';
import { Clock, Users, CheckCircle, AlertCircle, QrCode } from 'lucide-react';

const stat = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
  <div className="card flex items-center gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50">{icon}</div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold leading-tight text-gray-900">{value}</p>
    </div>
  </div>
);

export default function Dashboard() {
  const [employees, setEmployees] = useState(0);
  const [checkedIn, setCheckedIn] = useState(0);
  const [active, setActive] = useState<any>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [empRes, sessRes] = await Promise.all([
        apiJson('/api/employees'),
        apiJson('/api/sessions'),
      ]);
      setEmployees(empRes.success ? (empRes.data as any[]).length : 0);
      const sessions = sessRes.success ? (sessRes.data as any[]) : [];
      const current = sessions.find((s: any) => s.status === 'ACTIVE') || null;
      setActive(current);
      if (current) {
        const recRes = await apiJson(`/api/attendance/session/${current.id}/records`);
        setCheckedIn(recRes.success ? (recRes.data as any[]).length : 0);
        try {
          const qrRes = await apiRequest(`/api/sessions/${current.id}/qr`);
          if (qrRes.ok) setQrSrc(URL.createObjectURL(await qrRes.blob()));
        } catch {
          // QR not generated yet or offline — the "Mở mã QR" link still works.
        }
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="card p-6">Đang tải…</div>;
  const notChecked = Math.max(0, employees - checkedIn);
  const pct = employees ? Math.round((checkedIn / employees) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
        <p className="mt-1 text-sm text-gray-600">Thông tin chi tiết về phiên chấm công hiện tại.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat(<Users className="h-5 w-5 text-blue-600" />, 'Tổng nhân sự', employees)}
        {stat(<CheckCircle className="h-5 w-5 text-green-600" />, 'Đã check-in', <span className="text-green-600">{checkedIn}</span>)}
        {stat(<AlertCircle className="h-5 w-5 text-amber-600" />, 'Chưa check-in', <span className="text-amber-600">{notChecked}</span>)}
        {stat(<Clock className="h-5 w-5 text-blue-600" />, 'Hoàn thành', <span className="text-blue-600">{pct}%</span>)}
      </div>

      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Phiên hiện tại</h2>
            {active ? (
              <>
                <p className="mt-1 font-medium text-gray-900">{active.sessionName}</p>
                <p className="text-sm text-gray-500">
                  {new Date(active.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {new Date(active.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {active._count?.records ?? checkedIn} người đã điểm danh
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-500">Không có phiên đang hoạt động.</p>
            )}
          </div>
          {active && (
            <Link to={`/sessions/${active.id}`} className="btn-primary text-sm">
              <QrCode size={16} /> Mở mã QR
            </Link>
          )}
        </div>
        {qrSrc && (
          <div className="mt-4 flex items-center gap-4">
            <img src={qrSrc} alt="QR phiên hiện tại" className="h-40 w-40 rounded-lg border border-gray-200 bg-white p-2" />
            <p className="text-xs text-gray-500">
              Quét mã để điểm danh, hoặc mở trang phiên để xem link dự phòng.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
