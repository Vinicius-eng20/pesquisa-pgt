const TOKEN_KEY = "fm_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  suspended: boolean;
}
export interface Service {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  status: "approved" | "pending" | "removed";
  ownerName?: string;
  createdAt: string;
}
export interface Contract {
  id: number;
  serviceTitle: string;
  clientName: string;
  providerName: string;
  status: "active" | "cancelled";
  createdAt: string;
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers["Authorization"] = token;

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor. Verifique sua internet e se o site está no ar.");
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new ApiError(data?.error || "Ocorreu um erro. Tente novamente.");
  }
  return data as T;
}

export const api = {
  // Auth
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/api/me"),
  updateMe: (name: string, password: string) =>
    request<{ user: User }>("/api/me", { method: "PUT", body: JSON.stringify({ name, password }) }),

  // Services
  listServices: () => request<{ services: Service[] }>("/api/services"),
  myServices: () => request<{ services: Service[] }>("/api/services/mine"),
  publishService: (data: { title: string; description: string; category: string; price: number }) =>
    request<{ service: Service }>("/api/services", { method: "POST", body: JSON.stringify(data) }),
  deleteService: (id: number) => request<{ ok: boolean }>(`/api/services/${id}`, { method: "DELETE" }),

  // Contracts
  myContracts: () => request<{ contracts: Contract[] }>("/api/contracts/mine"),
  createContract: (serviceId: number) =>
    request<{ contract: Contract }>("/api/contracts", { method: "POST", body: JSON.stringify({ serviceId }) }),

  // Admin
  adminServices: () => request<{ services: Service[] }>("/api/admin/services"),
  adminUsers: () => request<{ users: any[] }>("/api/admin/users"),
  adminContracts: () => request<{ contracts: Contract[] }>("/api/admin/contracts"),
  setServiceStatus: (id: number, status: string) =>
    request<{ ok: boolean }>(`/api/admin/services/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
  setSuspended: (id: number, suspended: boolean) =>
    request<{ user: User }>(`/api/admin/users/${id}/suspend`, { method: "PUT", body: JSON.stringify({ suspended }) }),
};
