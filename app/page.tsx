"use client";

import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/contexts/AuthContext";
import { getCabinetPath } from "@/lib/auth/roles";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (user) {
      router.replace(getCabinetPath(user.role));
      return;
    }

    router.replace("/login");
  }, [loading, router, user]);

  return <LoadingState label="Загрузка…" variant="screen" />;
}
