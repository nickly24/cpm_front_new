"use client";

import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/auth/types";
import { getNavigation, getSectionHref } from "@/lib/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  role: UserRole;
  userName: string;
  userRoleLabel: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  variant?: "desktop" | "drawer";
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  role,
  userName,
  userRoleLabel,
  collapsed,
  onToggleCollapsed,
  variant = "desktop",
  isOpen = false,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const navigation = getNavigation(role);
  const isDrawer = variant === "drawer";
  const isCompact = !isDrawer && collapsed;

  const handleNavigate = () => {
    if (isDrawer) {
      onClose?.();
    }
  };

  return (
    <aside
      className={cn(
        "cabinet-sidebar",
        isDrawer ? "cabinet-sidebar--drawer" : "cabinet-sidebar--desktop",
        isDrawer && isOpen && "is-open",
        isCompact && "is-collapsed",
      )}
      aria-label="Навигация"
      aria-hidden={isDrawer ? !isOpen : undefined}
    >
      <div className="cabinet-sidebar-header">
        <Image src="/logo.svg" alt="CPM" width={40} height={40} />
        {!isCompact ? (
          <span className="cabinet-sidebar-brand">{navigation.brand}</span>
        ) : null}
        {isDrawer ? (
          <button
            type="button"
            className="cabinet-sidebar-close"
            onClick={onClose}
            aria-label="Закрыть меню"
          >
            <X size={20} />
          </button>
        ) : null}
      </div>

      <nav className="cabinet-sidebar-nav">
        {navigation.groups.map((group) => (
          <div key={group.title} className="cabinet-nav-group">
            {!isCompact ? (
              <p className="cabinet-nav-group-title">{group.title}</p>
            ) : null}
            <ul className="cabinet-nav-list">
              {group.items.map((item) => {
                const href = getSectionHref(role, item.id);
                const isActive =
                  pathname === href || pathname.startsWith(`${href}/`);
                const Icon = item.icon;

                return (
                  <li key={item.id}>
                    <Link
                      href={href}
                      className={cn(
                        "cabinet-nav-link",
                        isActive && "is-active",
                        isCompact && "is-collapsed",
                      )}
                      title={isCompact ? item.label : undefined}
                      onClick={handleNavigate}
                    >
                      <Icon size={18} />
                      {!isCompact ? <span>{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="cabinet-sidebar-user">
        <div className="cabinet-sidebar-avatar">
          {userName.charAt(0).toUpperCase()}
        </div>
        {!isCompact ? (
          <div className="cabinet-sidebar-user-text">
            <p className="cabinet-sidebar-user-name">{userName}</p>
            <p className="cabinet-sidebar-user-role">{userRoleLabel}</p>
          </div>
        ) : null}
      </div>

      <div className="cabinet-sidebar-spacer" aria-hidden />

      {!isDrawer ? (
        <div className="cabinet-sidebar-footer">
          <button
            type="button"
            className="cabinet-sidebar-toggle"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
            title={collapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
            {!isCompact ? <span>Свернуть меню</span> : null}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
