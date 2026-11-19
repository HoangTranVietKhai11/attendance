import { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import Employees from './pages/Employees';
import Networks from './pages/Networks';
import Reports from './pages/Reports';
import CheckIn from './pages/CheckIn';
import { apiRequest } from './lib/api';

function ProtectedLayout() {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest('/api/auth/me');
        if (!cancelled) setAuthed(res.ok);
      } catch {
        // Network/CORS failure — treat as unauthenticated instead of hanging.
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <div className="p-8 text-sm text-gray-500">Đang tải…</div>;
  if (!authed) return <Navigate to="/login" replace state={{ from: location }} />;

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </>
  );
}

function NavBar() {
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-gray-900 tracking-tight">MondayCheck</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-ghost text-sm"
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate('/sessions')}
            className="btn-ghost text-sm"
          >
            Sessions
          </button>
          <button
            onClick={() => navigate('/employees')}
            className="btn-ghost text-sm"
          >
            Employees
          </button>
          <button
            onClick={() => navigate('/networks')}
            className="btn-ghost text-sm"
          >
            Wi-Fi
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="btn-ghost text-sm"
          >
            Reports
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('mc_token');
              navigate('/login');
            }}
            className="flex items-center gap-1.5 btn-ghost text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/networks" element={<Networks />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}