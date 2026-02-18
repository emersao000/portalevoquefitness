export const API_BASE: string = (() => {
  const envBase = (import.meta as any)?.env?.VITE_API_BASE as
    | string
    | undefined;
  if (envBase && envBase.trim()) return envBase.trim();

  const envUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim() + "/api";

  return "/api";
})();

export function apiFetch(path: string, init?: RequestInit) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${p}`;
  return fetch(url, init);
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

export const api = {
  async get<T = any>(path: string): Promise<ApiResponse<T>> {
    const response = await apiFetch(path);
    if (!response.ok) {
      const error = new Error("API Error") as any;
      error.response = { status: response.status, data: await response.json() };
      throw error;
    }
    return {
      data: await response.json(),
      status: response.status,
    };
  },

  async post<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    const response = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = new Error("API Error") as any;
      error.response = { status: response.status, data: await response.json() };
      throw error;
    }
    return {
      data: await response.json(),
      status: response.status,
    };
  },

  async patch<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    const response = await apiFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = new Error("API Error") as any;
      error.response = { status: response.status, data: await response.json() };
      throw error;
    }
    return {
      data: await response.json(),
      status: response.status,
    };
  },

  async delete<T = any>(path: string): Promise<ApiResponse<T>> {
    const response = await apiFetch(path, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = new Error("API Error") as any;
      try {
        error.response = {
          status: response.status,
          data: await response.json(),
        };
      } catch {
        error.response = { status: response.status, data: null };
      }
      throw error;
    }
    return {
      data: await response.json().catch(() => null),
      status: response.status,
    };
  },
};
