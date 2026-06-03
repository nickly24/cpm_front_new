import { apiRequest } from "@/lib/api/client";
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
  };
}

export async function loginRequest(
  login: string,
  password: string,
): Promise<{ user: User } | { error: string }> {
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
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Ошибка входа",
    };
  }
}

export async function checkAuthRequest(): Promise<User | null> {
  const token = getToken();

  if (!token) {
    return null;
  }

  try {
    const data = await apiRequest<AunResponse>("/api/aun", {
      method: "POST",
    });

    return mapAunToUser(data);
  } catch {
    removeToken();
    return null;
  }
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiRequest<{ status: boolean }>("/api/logout", {
      method: "POST",
    });
  } finally {
    removeToken();
  }
}
