/**
 * Crash-Proof API Client for Tributary
 * Enforces JSON validation, checks network reachability, and prevents uncaught EOF/JSON parsing crashes.
 */
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      ...options,
    });
  } catch (networkErr) {
    throw new Error('Cannot reach Tributary API server. Please ensure the server is running and check network connectivity.');
  }

  const rawText = await res.text();
  if (!rawText) {
    throw new Error(`API ${path} returned an empty response (HTTP ${res.status}). Check backend server logs.`);
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`API ${path} returned non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 120)}`);
  }

  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status} error on ${path}`);
  }

  return data as T;
}

export interface HealthStatus {
  status: string;
  mode: string;
  port: number;
  timestamp: string;
}

export async function checkApiHealth(): Promise<HealthStatus> {
  return apiRequest<HealthStatus>('/api/health');
}
