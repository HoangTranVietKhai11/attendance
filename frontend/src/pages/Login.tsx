import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../lib/api';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await apiJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (res.success && res.data?.token) {
      localStorage.setItem('mc_token', res.data.token);
      navigate('/dashboard', { replace: true });
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="card w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <LogIn className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">MondayCheck</span>
        </div>
        <h2 className="mb-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">
          HR – Đăng nhập
        </h2>
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700 border border-red-100">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tài khoản
            </label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="hr"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Mật khẩu
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
        <p className="mt-6 text-xs text-gray-500 text-center">
          demo: hr / Admin@123
        </p>
      </div>
    </div>
  );
}