import { BFF_DEV } from "@/lib/config";
import { bffRequest, acceptIdentity, announceSession, exclusiveContext, type Identity } from "@/lib/bff/client";
import { ApiError, apiRequest } from "@/lib/api/client";
import type { AunResponse, AuthResponse, User } from "./types";
import { isUserRole } from "./roles";
import { getToken, removeToken, setToken } from "./storage";

function mapAunToUser(data: AunResponse): User | null {
  if (!data.status || !data.role || data.entity_id == null || !data.full_name) {
    return null;
  }

  if (!isUserRole(data.role)) {
    return null;
  }

  return {
    role: data.role,
    id: data.entity_id,
    full_name: data.full_name,
    group_id: data.group_id ?? null,
    role_id: data.role_id,
    role_name: data.role_name,
    permissions: data.permissions,
  };
}

export async function loginRequest(
  login: string,
  password: string,
): Promise<{ user: User } | { error: string }> {
  if (BFF_DEV) {
    try { const data = await bffRequest<Identity>("/auth/login", { method: "POST", body: JSON.stringify({ login, password }) }); const user = acceptIdentity(data); announceSession(); return { user }; }
    catch (e) { return { error: e instanceof Error ? e.message : "Ошибка входа" }; }
  }
  try {
    const data = await apiRequest<AuthResponse>("/api/auth", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    });

    if (!data.status || !data.user || !data.token) {
      return { error: data.message || "Ошибка входа" };
    }

    if (!isUserRole(data.user.role)) {
      return { error: "Неизвестная роль пользователя" };
    }

    setToken(data.token);

    return {
      user: {
        role: data.user.role,
        id: data.user.id,
        full_name: data.user.full_name,
        group_id: data.user.group_id ?? null,
        role_id: data.user.role_id,
        role_name: data.user.role_name,
        permissions: data.user.permissions,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Ошибка входа",
    };
  }
}

export async function checkAuthRequest(preserveOnNetworkError = false): Promise<User | null> {
  if (BFF_DEV) {
    try { return acceptIdentity(await bffRequest<Identity>("/auth/me")); }
    catch (e) { if ((e as { status?: number }).status === 401) return null; throw e; }
  }
  const token = getToken();

  if (!token) {
    return null;
  }

  try {
    const data = await apiRequest<AunResponse>("/api/aun", {
      method: "POST",
    });

    return mapAunToUser(data);
  } catch (error) {
    if (preserveOnNetworkError && !(error instanceof ApiError && error.status === 401)) throw error;
    removeToken();
    return null;
  }
}

export async function logoutRequest(): Promise<void> {
  if (BFF_DEV) { await exclusiveContext(() => bffRequest("/auth/logout", { method: "POST" })); announceSession(); window.location.replace("/login"); return; }
  try {
    await apiRequest<{ status: boolean }>("/api/logout", {
      method: "POST",
    });
  } finally {
    removeToken();
  }
}
