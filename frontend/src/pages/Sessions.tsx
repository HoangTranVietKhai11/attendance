import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { QrCode, Play, X, Plus } from 'lucide-react';

export default function Sessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('11:00');
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await apiJson('/api/sessions');
    if (res.success) setSessions(res.data);
    setLoading(false);
  }

  async function createSession() {
    if (!name || !date || !start || !end) return;
    setCreating(true);
    const base = `${date}T`;
    const sessionDate = new Date(`${base}${start}:00`).toISOString();
    const startTime = new Date(`${base}${start}:00`).toISOString();
    const endTime = new Date(`${base}${end}:00`).toISOString();
    const res = await apiJson('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ sessionName: name, sessionDate, startTime, endTime }),
    });
    setCreating(false);
    if (res.success && res.data) {
      localStorage.setItem(`mc_qr_${res.data.id}`, res.data.qrToken || '');
      navigate(`/sessions/${res.data.id}`);
    }
  }

  async function toggleStatus(id: string, status: 'ACTIVE' | 'CLOSED') {
    const action = status === 'ACTIVE' ? 'start' : 'close';
    await apiJson(`/api/sessions/${id}/${action}`, { method: 'PATCH' });
    load();
  }

  if (loading) return <div className="card p-6">Đang tải…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý phiên</h1>
          <p className="text-gray-600 text-sm">Tạo phiên chấm công hàng tuần và xuất mã QR.</p>
        </div>
        <Link to="/checkin" className="btn-ghost text-sm">
          Trang điểm danh (nhân sự)
        </Link>
      </div>

      <div className="card">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Tạo phiên mới</h3>
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Tên phiên (ví dụ: Thứ 2, 14/07/2025)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button className="btn-primary w-full" onClick={createSession} disabled={creating}>
            {creating ? 'Đang tạo…' : <><Plus size={18} /> Tạo phiên</>}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="table-header">Tên phiên</th>
              <th className="table-header">Ngày</th>
              <th className="table-header">Thời gian</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header text-right">Đã điểm danh</th>
              <th className="table-header text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{s.sessionName}</td>
                <td className="table-cell text-gray-600">{new Date(s.sessionDate).toLocaleDateString('vi-VN')}</td>
                <td className="table-cell text-gray-600">
                  {new Date(s.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} –
                  {new Date(s.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="table-cell">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                    s.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : s.status === 'CLOSED'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {s.status === 'ACTIVE' ? 'Đang mở' : s.status === 'CLOSED' ? 'Đã đóng' : 'Lên lịch'}
                  </span>
                </td>
                <td className="table-cell text-right font-medium">{s._count?.records ?? 0}</td>
                <td className="table-cell text-right">
                  {s.status === 'SCHEDULED' && (
                    <button onClick={() => toggleStatus(s.id, 'ACTIVE')} className="btn-ghost text-xs text-green-600 hover:bg-green-50">
                      <Play size={14} /> Mở
                    </button>
                  )}
                  {s.status === 'ACTIVE' && (
                    <>
                      <button
                        onClick={() => toggleStatus(s.id, 'CLOSED')}
                        className="btn-ghost text-xs text-red-600 hover:bg-red-50 mr-2"
                      >
                        <X size={14} /> Đóng
                      </button>
                      <Link to={`/sessions/${s.id}`} className="btn-ghost text-xs text-blue-600 hover:bg-blue-50">
                        <QrCode size={14} /> QR
                      </Link>
                    </>
                  )}
                  {s.status === 'CLOSED' && (
                    <Link to={`/sessions/${s.id}`} className="btn-ghost text-xs text-blue-600 hover:bg-blue-50">
                      Xem chi tiết
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}