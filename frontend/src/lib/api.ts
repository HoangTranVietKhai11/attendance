/// <reference types="vite/client" />

// Empty by default so requests stay same-origin (`/api/...`), which works through the
// Nginx reverse proxy (port 80) and the Vite dev proxy. Only set VITE_API_BASE when the
// API lives on a different origin.
export const API_BASE = import.meta.env.VITE_API_BASE || '';

export function apiUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mc_token');
}

export async function apiRequest(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getToken();
  let url: string;
  if (typeof input === 'string') {
    url = input.startsWith('http') ? input : `${API_BASE}${input}`;
  } else {
    url = input.toString();
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers });
  return res;
}

export async function apiJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  let res: Response;
  try {
    res = await apiRequest(input, init);
  } catch {
    // Network failure / CORS block / server unreachable — never leave the UI hanging.
    return { success: false, error: 'Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.' };
  }
  let body: any = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) body = await res.json();
  if (!res.ok) {
    return { success: false, error: body?.error || `Request failed (${res.status})` };
  }
  return { success: true, data: body?.data };
}

export function uploadJson<T = any>(
  url: string,
  body: any
): Promise<{ success: boolean; data?: T; error?: string }> {
  return apiJson<T>(url, { method: 'POST', body: JSON.stringify(body) });
}