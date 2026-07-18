"use client";

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

  const checkAuth = useCallback(async () => {
    setLoading(true);

    try {
      const currentUser = await checkAuthRequest();
      setUser(currentUser);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

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
    try {
      Object.keys(localStorage).filter((key) => key.startsWith("homework-chat-draft-")).forEach((key) => localStorage.removeItem(key));
    } catch { /* storage unavailable */ }
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
