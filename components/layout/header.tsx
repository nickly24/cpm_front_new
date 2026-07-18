"use client";

import { Button } from "@/components/ui/button";
import { SectionSearch } from "@/components/layout/section-search";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/auth/types";
import { LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/layout/notification-bell";

interface HeaderProps {
  role: UserRole;
  onMenuOpen?: () => void;
}

export function Header({ role, onMenuOpen }: HeaderProps) {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
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

      <SectionSearch role={role} />

      <div className="cabinet-header-actions">
        <NotificationBell role={role} />
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
          <LogOut size={16} />
          <span className="cabinet-header-logout-text">Выйти</span>
        </Button>
      </div>
    </header>
  );
}
