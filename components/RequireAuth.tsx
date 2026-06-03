"use client";

import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import { getCabinetPath } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

interface RequireAuthProps {
  role?: UserRole;
  children: ReactNode;
}

export function RequireAuth({ role, children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role && user.role !== role) {
      router.replace(getCabinetPath(user.role));
    }
  }, [loading, role, router, user]);

  if (loading || !user || (role && user.role !== role)) {
    return <LoadingState label="Загрузка…" variant="screen" />;
  }

  return children;
}
