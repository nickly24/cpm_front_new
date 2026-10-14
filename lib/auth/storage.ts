import { BFF_DEV } from "@/lib/config";
const TOKEN_KEY = "auth_token";

export function getToken(): string | null {
  if (BFF_DEV || typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (BFF_DEV) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (BFF_DEV) return;
  localStorage.removeItem(TOKEN_KEY);
}
