import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiJson, uploadJson } from '../lib/api';
import { Plus, Trash2, FileText, Search } from 'lucide-react';

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [email, setEmail] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null);

  useEffect(() => {
    load();
  }, [query]);

  async function load() {
    const res = await apiJson(`/api/employees?q=${encodeURIComponent(query)}`);
    if (res.success) setEmployees(res.data);
    setLoading(false);
  }

  async function createEmployee() {
    if (!code || !name) return;
    setSaving(true);
    const res = await apiJson('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ employeeCode: code, fullName: name, department: dept || undefined, email: email || undefined }),
    });
    setSaving(false);
    if (res.success) {
      setCode(''); setName(''); setDept(''); setEmail('');
      load();
    }
  }

  async function deactivate(id: string) {
    if (!window.confirm('Ngừng kích hoạt nhân sự này?')) return;
    await apiJson(`/api/employees/${id}`, { method: 'DELETE' });
    load();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const res = await uploadJson('/api/employees/import', { fileName: file.name, contentBase64: base64 });
    if (res.success) setImportResult(res.data);
    load();
    e.target.value = '';
  }

  if (loading) return <div className="card p-6">Đang tải…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhân sự</h1>
          <p className="text-gray-600 text-sm">Quản lý danh sách nhân sự có quyền điểm danh.</p>
        </div>
        <Link to="/checkin" className="btn-ghost text-sm">
          <FileText size={16} /> Trang điểm danh
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Tìm theo mã NV, tên hoặc phòng ban…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Thêm nhân sự mới</h3>
        <form onSubmit={(e) => { e.preventDefault(); createEmployee(); }} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <input className="input" placeholder="Mã NV" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="input" placeholder="Họ và tên" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Phòng ban" value={dept} onChange={(e) => setDept(e.target.value)} />
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary" disabled={saving}>{saving ? '…' : <><Plus size={16} /> Thêm</>}</button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Danh sách nhân sự ({employees.length})</span>
          </div>
          <button
            onClick={() => document.getElementById('import-file')?.click()}
            className="btn-ghost text-xs text-blue-600 hover:bg-blue-50"
          >
            Nhập từ Excel/CSV
          </button>
          <input id="import-file" type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImport} />
          {importResult && (
            <div className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-100">
              Đã nhập {importResult.imported}/{importResult.total} nhân sự.
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Mã NV</th>
                <th className="table-header">Họ và tên</th>
                <th className="table-header">Phòng ban</th>
                <th className="table-header">Email</th>
                <th className="table-header">Trạng thái</th>
                <th className="table-header text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{e.employeeCode}</td>
                  <td className="table-cell">{e.fullName}</td>
                  <td className="table-cell text-gray-600">{e.department || '—'}</td>
                  <td className="table-cell text-gray-600 text-xs">{e.email || '—'}</td>
                  <td className="table-cell">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                      e.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {e.isActive ? 'Đang làm việc' : 'Đã nghỉ'}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    {!e.isActive ? null : (
                      <button onClick={() => deactivate(e.id)} className="btn-ghost text-xs text-red-600 hover:bg-red-50">
                        <Trash2 size={14} /> Ngừng KC
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-gray-500 text-sm">
                    Chưa có nhân sự. Hãy thêm thủ công hoặc nhập từ file Excel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}