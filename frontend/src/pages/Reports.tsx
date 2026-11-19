/// <reference types="vite/client" />

import { useState, useEffect } from 'react';
import { apiJson, apiUrl } from '../lib/api';
import { Download, ClipboardList } from 'lucide-react';

export default function Reports() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    apiJson('/api/sessions').then((res) => {
      if (res.success) setSessions(res.data);
    });
  }, []);

  async function handleExport() {
    if (!sessionId) return;
    setExporting(true);
    window.location.href = `${apiUrl('/api/reports/export')}?sessionId=${encodeURIComponent(sessionId)}`;
    setTimeout(() => setExporting(false), 1000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo &amp; xuất dữ liệu</h1>
        <p className="text-gray-600 text-sm">Xuất bảng chấm công theo tuần ra Excel/CSV.</p>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-medium text-gray-600 mb-2">Chọn phiên chấm công</label>
            <select
              className="input"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">-- Chọn phiên --</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sessionName} ({new Date(s.sessionDate).toLocaleDateString('vi-VN')})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            disabled={!sessionId || exporting}
            className="btn-primary"
          >
            {exporting ? 'Đang xuất…' : <><Download size={16} /> Xuất Excel</>}
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          File Excel sẽ chứa: Mã NV, Họ tên, Phòng ban, Giờ check-in, IP, Trạng thái.
        </p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <ClipboardList size={16} />
          <span>Hướng dẫn</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
          <li>Chọn phiên chấm công muốn xuất báo cáo.</li>
          <li>Nhấn «Xuất Excel» để tải file về máy.</li>
          <li>Chỉ có dữ liệu của các phiên đã được tạo trong hệ thống.</li>
        </ul>
      </div>
    </div>
  );
}