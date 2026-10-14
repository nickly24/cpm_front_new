"use client";
import { BFF_DEV } from "@/lib/config";
import { resetRequests } from "@/lib/bff/client";


import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  checkAuthRequest,
  loginRequest,
  logoutRequest,
} from "@/lib/auth/api";
import type { User } from "@/lib/auth/types";
import { clearScannerProjects } from "@/lib/homework-scanner/project-store";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{
    success: boolean;
    message?: string;
  }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  const checkAuth = useCallback(async () => {

    try {
      const currentUser = await checkAuthRequest();
      setUser(currentUser);
      setConnectionError(false);
    } catch {
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user?.role !== "staff_admin") return;
    let active = true;
    const refresh = async () => {
      try {
        const current = await checkAuthRequest(true);
        if (active) setUser(current);
      } catch { /* A temporary network failure does not invalidate the session. */ }
    };
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    const timer = window.setInterval(focus, 30_000);
    return () => { active = false; window.removeEventListener("focus", focus); window.clearInterval(timer); };
  }, [user?.role]);

  useEffect(() => {
    if (!BFF_DEV) return;
    const expired = () => { resetRequests(); setUser(null); };
    const sync = (event: StorageEvent) => { if (event.key === "cpm-bff-session-event") { resetRequests(); window.location.replace(window.location.pathname); } };
    const focus = () => { void checkAuthRequest(true).then(value => setUser(value)).catch(() => {}); };
    window.addEventListener("storage", sync); window.addEventListener("focus", focus); window.addEventListener("bff-session-expired", expired);
    const timer = window.setInterval(focus, 30000);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", focus); window.removeEventListener("bff-session-expired", expired); clearInterval(timer); };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginRequest(username, password);

    if ("error" in result) {
      return { success: false, message: result.error };
    }

    setUser(result.user);
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    await clearScannerProjects().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{BFF_DEV && connectionError ? <div className="login-page"><div className="ds-card" role="alert"><h2>Сервис входа временно недоступен</h2><p>Повторите подключение. Текущая сессия сохранена.</p><button type="button" onClick={() => void checkAuth()}>Повторить</button></div></div> : children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
