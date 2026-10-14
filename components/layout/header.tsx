"use client";

import { BFF_DEV } from "@/lib/config";
import { CabinetContext } from "./cabinet-context";
import { Button } from "@/components/ui/button";
import { SectionSearch } from "@/components/layout/section-search";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/auth/types";
import { LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  role: UserRole;
  onMenuOpen?: () => void;
}

export function Header({ role, onMenuOpen }: HeaderProps) {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try { await logout(); router.replace("/login"); } catch(e) { window.alert(e instanceof Error ? e.message : "Не удалось выйти"); }
  };

  return (
    <header className="cabinet-header">
      <button
        type="button"
        className="cabinet-header-menu-btn"
        onClick={onMenuOpen}
        aria-label="Открыть меню"
      >
        <Menu size={22} />
      </button>

      {BFF_DEV ? <CabinetContext /> : <SectionSearch role={role} />}

      <div className="cabinet-header-actions">
        <ThemeToggle />
        <Button variant="ghost" size="sm" aria-label="Выйти из кабинета" onClick={() => void handleLogout()}>
          <LogOut size={16} />
          <span className="cabinet-header-logout-text">Выйти</span>
        </Button>
      </div>
    </header>
  );
}
