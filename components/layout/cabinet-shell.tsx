"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import {
  CabinetChromeProvider,
  useCabinetChrome,
} from "@/contexts/cabinet-chrome-context";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/auth/types";
import { type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HomeworkUploadProvider } from "@/contexts/homework-upload-context";

interface CabinetShellProps {
  role: UserRole;
  children: ReactNode;
}

const ROLE_TITLES: Record<UserRole, string> = {
  student: "Студент",
  proctor: "Проктор",
  admin: "Администратор",
  examinator: "Экзаменатор",
  supervisor: "Супервайзер",
};

const SIDEBAR_COLLAPSED_KEY = "cpm-sidebar-collapsed";

export function CabinetShell({ role, children }: CabinetShellProps) {
  return (
    <RequireAuth role={role}>
      <CabinetChromeProvider>
        <HomeworkUploadProvider>
          <CabinetLayout role={role}>{children}</CabinetLayout>
        </HomeworkUploadProvider>
      </CabinetChromeProvider>
    </RequireAuth>
  );
}

function CabinetLayout({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { immersive } = useCabinetChrome();
  const pathname = usePathname();
  const userName = user?.full_name ?? "Пользователь";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <div
      className="cabinet-layout"
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
      data-mobile-menu-open={mobileMenuOpen ? "true" : "false"}
      data-immersive={immersive ? "true" : "false"}
    >
      {mobileMenuOpen ? (
        <button
          type="button"
          className="cabinet-mobile-overlay"
          aria-label="Закрыть меню"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      {!immersive ? (
        <Sidebar
          variant="desktop"
          role={role}
          userName={userName}
          userRoleLabel={ROLE_TITLES[role]}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        />
      ) : null}

      {!immersive ? (
        <Sidebar
          variant="drawer"
          role={role}
          userName={userName}
          userRoleLabel={ROLE_TITLES[role]}
          collapsed={false}
          onToggleCollapsed={() => {}}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <div className="cabinet-main">
        {!immersive ? (
          <Header role={role} onMenuOpen={() => setMobileMenuOpen(true)} />
        ) : null}
        <main className="cabinet-content">{children}</main>
      </div>
    </div>
  );
}
